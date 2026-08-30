import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    asArray, asObject, assertParameterNames, JsonObject, ParameterTableData,
    ProjectFile, ProjectSnapshot, readParameterDescriptions, readParameters, text, TreeAteNode,
    writeParameterDescriptions, writeParameters
} from './model';

export class ProjectStore implements vscode.Disposable {
    private snapshot?: ProjectSnapshot;
    private watcher?: vscode.FileSystemWatcher;
    private suppressWatcherUntil = 0;
    private readonly changedEmitter = new vscode.EventEmitter<void>();
    readonly onDidChange = this.changedEmitter.event;

    get current(): ProjectSnapshot | undefined { return this.snapshot; }
    get rootNode(): TreeAteNode | undefined {
        if (!this.snapshot) { return undefined; }
        return {
            id: 'project', kind: 'project',
            name: text(this.snapshot.tpx.data.Name) || path.basename(this.snapshot.rootDir),
            description: text(this.snapshot.tpx.data.Desc)
        };
    }

    async open(rootDir: string): Promise<void> {
        const entries = await fs.readdir(rootDir, { withFileTypes: true });
        const tpxNames = entries.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.tpx')).map(entry => entry.name);
        if (!tpxNames.length) { throw new Error('所选文件夹中没有找到 .tpx 文件。'); }
        const preferred = tpxNames.find(name => path.parse(name).name.toLowerCase() === path.basename(rootDir).toLowerCase()) ?? tpxNames[0];
        const tpxPath = path.join(rootDir, preferred);
        const tpx = await this.readProjectFile(tpxPath);

        const references = asArray(tpx.data.Instance).map(item => text(item.File)).filter(file => file.toLowerCase().endsWith('.tp'));
        const diskTp = entries.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.tp')).map(entry => entry.name);
        const names = [...new Set([...references, ...diskTp])];
        const tpFiles: ProjectFile[] = [];
        for (const name of names) {
            const filePath = path.resolve(rootDir, name);
            if (!this.isInside(rootDir, filePath)) { continue; }
            try { tpFiles.push(await this.readProjectFile(filePath)); } catch { /* stale Instance references remain untouched */ }
        }
        if (!tpFiles.length) { throw new Error('工程中没有可读取的 .tp 文件。'); }

        this.snapshot = { rootDir, tpx: { path: tpxPath, data: tpx.data }, tpFiles };
        this.watch(rootDir);
        await vscode.commands.executeCommand('setContext', 'treeate.projectOpen', true);
        this.changedEmitter.fire();
    }

    async reload(): Promise<void> {
        if (this.snapshot) { await this.open(this.snapshot.rootDir); }
    }

    getChildren(parent?: TreeAteNode): TreeAteNode[] {
        if (!this.snapshot) { return []; }
        if (!parent) { return this.rootNode ? [this.rootNode] : []; }
        if (parent.kind === 'project') {
            return this.snapshot.tpFiles.flatMap(tp => asArray(tp.data.TestSuite).map((suite, suiteIndex) => ({
                id: this.nodeId('suite', tp.path, suiteIndex), kind: 'suite' as const,
                name: text(suite.Name) || `suite${suiteIndex + 1}`, description: text(suite.Desc),
                tpPath: tp.path, suiteIndex
            })));
        }
        if (parent.kind === 'suite') {
            const suite = this.resolveObject(parent);
            return asArray(suite?.TestCase).map((item, caseIndex) => ({
                id: this.nodeId('case', parent.tpPath!, parent.suiteIndex!, caseIndex), kind: 'case' as const,
                name: text(item.Name) || `test${caseIndex + 1}`, description: text(item.Desc),
                tpPath: parent.tpPath, suiteIndex: parent.suiteIndex, caseIndex
            }));
        }
        return [];
    }

    findNode(id: string): TreeAteNode | undefined {
        const root = this.rootNode;
        if (!root) { return undefined; }
        if (id === root.id) { return root; }
        for (const suite of this.getChildren(root)) {
            if (suite.id === id) { return suite; }
            const found = this.getChildren(suite).find(item => item.id === id);
            if (found) { return found; }
        }
        return undefined;
    }

    getParent(node: TreeAteNode): TreeAteNode | undefined {
        if (node.kind === 'project') { return undefined; }
        if (node.kind === 'suite') { return this.rootNode; }
        return this.rootNode ? this.getChildren(this.rootNode).find(suite => suite.tpPath === node.tpPath && suite.suiteIndex === node.suiteIndex) : undefined;
    }

    async addChild(parent: TreeAteNode, name: string): Promise<TreeAteNode> {
        if (!this.snapshot) { throw new Error('没有打开的工程。'); }
        if (parent.kind === 'project') {
            const tp = this.snapshot.tpFiles[0];
            const suites = this.ensureArray(tp.data, 'TestSuite');
            suites.push({ Desc: '', Name: name, Parameter: {}, TestCase: [] });
            await this.save(tp);
            return this.getChildren(this.rootNode!).find(item => item.tpPath === tp.path && item.suiteIndex === suites.length - 1)!;
        }
        if (parent.kind === 'suite') {
            const suite = this.resolveObject(parent)!;
            const cases = this.ensureArray(suite, 'TestCase');
            cases.push({ Desc: '', Name: name, Parameter: {} });
            await this.saveByPath(parent.tpPath!);
            return this.getChildren(parent).find(item => item.caseIndex === cases.length - 1)!;
        }
        throw new Error('测试项不能再添加子节点；工程树固定为三级。');
    }

    async insertSibling(node: TreeAteNode, name: string): Promise<void> {
        if (node.kind === 'suite') {
            const tp = this.fileByPath(node.tpPath!)!;
            asArray(tp.data.TestSuite).splice(node.suiteIndex! + 1, 0, { Desc: '', Name: name, Parameter: {}, TestCase: [] });
            await this.save(tp);
        } else if (node.kind === 'case') {
            const suite = this.resolveSuite(node)!;
            asArray(suite.TestCase).splice(node.caseIndex! + 1, 0, { Desc: '', Name: name, Parameter: {} });
            await this.saveByPath(node.tpPath!);
        } else { throw new Error('根节点没有同级节点。'); }
    }

    async rename(node: TreeAteNode, name: string): Promise<void> {
        if (node.kind === 'project') {
            this.snapshot!.tpx.data.Name = name;
            await this.save(this.snapshot!.tpx);
            return;
        }
        const target = this.resolveObject(node)!;
        target.Name = name;
        await this.saveByPath(node.tpPath!);
    }

    async delete(node: TreeAteNode): Promise<void> {
        if (node.kind === 'suite') {
            const tp = this.fileByPath(node.tpPath!)!;
            asArray(tp.data.TestSuite).splice(node.suiteIndex!, 1);
            await this.save(tp);
        } else if (node.kind === 'case') {
            const suite = this.resolveSuite(node)!;
            asArray(suite.TestCase).splice(node.caseIndex!, 1);
            await this.saveByPath(node.tpPath!);
        } else { throw new Error('不能删除工程根节点。'); }
    }

    async reorder(source: TreeAteNode, target: TreeAteNode): Promise<void> {
        if (source.kind !== target.kind || source.tpPath !== target.tpPath || source.suiteIndex !== target.suiteIndex && source.kind === 'case') {
            throw new Error('只能调整同一父节点下的同级顺序。');
        }
        let array: JsonObject[];
        let from: number;
        let to: number;
        if (source.kind === 'suite') {
            array = asArray(this.fileByPath(source.tpPath!)!.data.TestSuite); from = source.suiteIndex!; to = target.suiteIndex!;
        } else if (source.kind === 'case') {
            array = asArray(this.resolveSuite(source)!.TestCase); from = source.caseIndex!; to = target.caseIndex!;
        } else { return; }
        const [moved] = array.splice(from, 1);
        array.splice(to, 0, moved);
        await this.saveByPath(source.tpPath!);
    }

    getParameterTable(selection?: TreeAteNode): ParameterTableData {
        if (!this.snapshot || !selection) { return { columns: [], rows: [] }; }
        const cases = selection.kind === 'project'
            ? this.getChildren(selection).flatMap(suite => this.getChildren(suite))
            : selection.kind === 'suite' ? this.getChildren(selection) : selection.kind === 'case' ? [selection] : [];
        const resolved = cases.map(node => ({ node, values: this.resolvedParameters(node) }));
        const columns = [...new Set(resolved.flatMap(row => Object.keys(row.values.values)))].sort();
        return {
            columns,
            rows: resolved.map(({ node, values }) => ({
                nodeId: node.id,
                label: `${this.getParent(node)?.name ?? ''} / ${node.name}`,
                cells: Object.fromEntries(columns.map(name => [name, {
                    value: values.values[name] ?? '',
                    inherited: values.sources[name] !== 'case',
                    source: values.sources[name] ?? 'none'
                }]))
            }))
        };
    }

    async setCell(nodeId: string, name: string, value: string): Promise<void> {
        assertParameterNames({ [name]: value });
        const node = this.findNode(nodeId);
        if (!node || node.kind !== 'case') { throw new Error('参数表只能编辑测试项行。'); }
        const target = this.resolveObject(node)!;
        const params = readParameters(target.Parameter);
        params[name] = value;
        writeParameters(target, params);
        await this.saveByPath(node.tpPath!);
    }

    getPropertyData(node: TreeAteNode): JsonObject {
        if (!this.snapshot) { return {}; }
        if (node.kind === 'project') {
            return {
                kind: 'tpx', title: path.basename(this.snapshot.tpx.path), path: this.snapshot.tpx.path,
                fields: Object.fromEntries(Object.entries(this.snapshot.tpx.data).filter(([key, value]) => key !== 'Instance' && (value === null || typeof value !== 'object'))),
                plugins: asArray(this.snapshot.tpx.data.GUIPlugins),
                instances: asArray(this.snapshot.tpx.data.Instance).map(item => ({ ...item, Parameter: readParameters(item.Parameter) }))
            };
        }
        const tp = this.fileByPath(node.tpPath!)!;
        const publicData = asObject(tp.data.Public);
        if (node.kind === 'tp') {
            return {
                kind: 'tp', title: path.basename(tp.path), path: tp.path,
                fields: { Name: text(tp.data.Name), Desc: text(tp.data.Desc), Ver: text(tp.data.Ver) },
                bindings: asArray(publicData.Models), globals: readParameters(tp.data.Parameter),
                publicParameters: readParameters(publicData.Parameter),
                publicParameterDescriptions: readParameterDescriptions(publicData.Parameter)
            };
        }
        const target = this.resolveObject(node)!;
        if (node.kind === 'suite') {
            return {
                kind: 'suite', title: node.name, path: tp.path,
                fields: { Name: text(target.Name), Desc: text(target.Desc) },
                bindings: asArray(publicData.Models), parameters: readParameters(target.Parameter),
                publicParameters: readParameters(publicData.Parameter),
                publicParameterDescriptions: readParameterDescriptions(publicData.Parameter)
            };
        }
        return {
            kind: 'case', title: node.name, path: tp.path,
            fields: { Name: text(target.Name), Desc: text(target.Desc) }, parameters: readParameters(target.Parameter)
        };
    }

    async savePropertyData(node: TreeAteNode, value: JsonObject): Promise<void> {
        if (!this.snapshot) { throw new Error('没有打开的工程。'); }
        if (node.kind === 'project') {
            const fields = asObject(value.fields);
            for (const [key, fieldValue] of Object.entries(fields)) {
                if (key !== 'Instance') { this.snapshot.tpx.data[key] = fieldValue; }
            }
            if (value.plugins) { this.snapshot.tpx.data.GUIPlugins = asArray(value.plugins); }
            const oldInstances = asArray(this.snapshot.tpx.data.Instance);
            this.snapshot.tpx.data.Instance = asArray(value.instances).map((instance, index) => {
                const parameters = asObject(instance.Parameter) as Record<string, string>;
                assertParameterNames(parameters);
                const fields = { ...instance };
                delete fields.Parameter;
                const merged = { ...(oldInstances[index] ?? { Parameter: [] }), ...fields };
                writeParameters(merged, parameters);
                return merged;
            });
            await this.save(this.snapshot.tpx);
            return;
        }
        const tp = this.fileByPath(node.tpPath!)!;
        const target = node.kind === 'tp' ? tp.data : this.resolveObject(node)!;
        const fields = asObject(value.fields);
        for (const [key, fieldValue] of Object.entries(fields)) { target[key] = fieldValue; }
        const parameters = asObject(value.parameters) as Record<string, string>;
        if (value.parameters) { assertParameterNames(parameters); writeParameters(target, parameters); }
        if (node.kind === 'tp') {
            const globals = asObject(value.globals) as Record<string, string>;
            assertParameterNames(globals); writeParameters(tp.data, globals);
        }
        if (node.kind === 'suite' || node.kind === 'tp') {
            const publicData = asObject(tp.data.Public);
            tp.data.Public = publicData;
            if (value.bindings) { publicData.Models = asArray(value.bindings); }
            const publicParameters = asObject(value.publicParameters) as Record<string, string>;
            assertParameterNames(publicParameters); writeParameters(publicData, publicParameters);
            if (value.publicParameterDescriptions !== undefined) {
                const descriptions = asObject(value.publicParameterDescriptions) as Record<string, string>;
                writeParameterDescriptions(publicData, descriptions);
            }
        }
        await this.save(tp);
    }

    tpNode(filePath: string): TreeAteNode | undefined {
        const file = this.fileByPath(filePath);
        return file ? { id: `tp:${file.path}`, kind: 'tp', name: text(file.data.Name) || path.parse(file.path).name, description: text(file.data.Desc), tpPath: file.path } : undefined;
    }

    associatedScript(node: TreeAteNode): string {
        const tpPath = node.tpPath ?? this.snapshot?.tpFiles[0]?.path;
        if (!tpPath) { throw new Error('未找到关联的 .tp 文件。'); }
        return tpPath.replace(/\.tp$/i, '.py');
    }

    functionNames(node: TreeAteNode): string[] {
        const safe = node.name.replace(/[^A-Za-z0-9_]/g, '_');
        if (node.kind === 'case') { return [`test_${safe}`]; }
        return [`setup_${safe}`, `teardown_${safe}`];
    }

    dispose(): void {
        this.watcher?.dispose();
        this.changedEmitter.dispose();
    }

    private resolvedParameters(node: TreeAteNode): { values: Record<string, string>; sources: Record<string, 'project' | 'suite' | 'case'> } {
        const tp = this.fileByPath(node.tpPath!)!;
        const suite = this.resolveSuite(node)!;
        const item = this.resolveObject(node)!;
        const groups: Array<['project' | 'suite' | 'case', Record<string, string>]> = [
            ['project', readParameters(tp.data.Parameter)],
            ['suite', readParameters(suite.Parameter)], ['case', readParameters(item.Parameter)]
        ];
        const values: Record<string, string> = {};
        const sources: Record<string, 'project' | 'suite' | 'case'> = {};
        for (const [source, params] of groups) { for (const [key, value] of Object.entries(params)) { values[key] = value; sources[key] = source; } }
        return { values, sources };
    }

    private resolveObject(node: TreeAteNode): JsonObject | undefined {
        if (node.kind === 'tp') { return this.fileByPath(node.tpPath!)?.data; }
        const suite = this.resolveSuite(node);
        return node.kind === 'suite' ? suite : asArray(suite?.TestCase)[node.caseIndex!];
    }

    private resolveSuite(node: TreeAteNode): JsonObject | undefined {
        const tp = node.tpPath ? this.fileByPath(node.tpPath) : undefined;
        return tp ? asArray(tp.data.TestSuite)[node.suiteIndex!] : undefined;
    }

    private fileByPath(filePath: string): ProjectFile | undefined {
        return this.snapshot?.tpFiles.find(file => path.normalize(file.path).toLowerCase() === path.normalize(filePath).toLowerCase());
    }

    private ensureArray(owner: JsonObject, key: string): JsonObject[] {
        if (!Array.isArray(owner[key])) { owner[key] = []; }
        return owner[key] as JsonObject[];
    }

    private async saveByPath(filePath: string): Promise<void> {
        const file = this.fileByPath(filePath);
        if (!file) { throw new Error(`找不到文件：${filePath}`); }
        await this.save(file);
    }

    private async save(file: ProjectFile): Promise<void> {
        this.suppressWatcherUntil = Date.now() + 500;
        await fs.writeFile(file.path, `${JSON.stringify(file.data, null, 4)}\n`, 'utf8');
        this.changedEmitter.fire();
    }

    private async readProjectFile(filePath: string): Promise<ProjectFile> {
        const content = (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
        let data: unknown;
        try { data = JSON.parse(content); } catch (error) { throw new Error(`${path.basename(filePath)} 不是有效 JSON：${String(error)}`); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) { throw new Error(`${path.basename(filePath)} 的根节点必须是 JSON 对象。`); }
        return { path: filePath, data: data as JsonObject };
    }

    private watch(rootDir: string): void {
        this.watcher?.dispose();
        const pattern = new vscode.RelativePattern(rootDir, '*.{tp,tpx}');
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const refresh = () => {
            if (Date.now() < this.suppressWatcherUntil) { return; }
            void this.reload().catch(error => vscode.window.showErrorMessage(`TreeATE 刷新失败：${String(error)}`));
        };
        this.watcher.onDidChange(refresh);
        this.watcher.onDidCreate(refresh);
        this.watcher.onDidDelete(refresh);
    }

    private nodeId(kind: string, filePath: string, first: number, second?: number): string {
        return `${kind}:${encodeURIComponent(filePath)}:${first}${second === undefined ? '' : `:${second}`}`;
    }

    private isInside(root: string, candidate: string): boolean {
        const relative = path.relative(path.resolve(root), path.resolve(candidate));
        return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    }
}
