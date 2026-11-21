import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    asArray, asObject, assertParameterNames, JsonObject, ParameterTableData,
    ProjectFile, ProjectSnapshot, readParameterDescriptions, readParameters, text, TreeAteNode,
    writeParameterDescriptions, writeParameters
} from './model';
import { t } from './i18n';
import { ParameterCsvInputRow, ParameterCsvRow, parseParameterCsv, serializeParameterCsv } from './parameterTableCsv';

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
        if (!tpxNames.length) { throw new Error(t('store.noTpx')); }
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
        if (!tpFiles.length) { throw new Error(t('store.noTp')); }

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
        if (id.startsWith('tp:')) {
            const file = this.fileByPath(id.slice(3));
            return file ? this.tpNode(file.path) : undefined;
        }
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
        if (!this.snapshot) { throw new Error(t('store.noProject')); }
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
        throw new Error(t('store.caseCannotAddChild'));
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
        } else { throw new Error(t('store.rootNoSibling')); }
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
        } else { throw new Error(t('store.cannotDeleteRoot')); }
    }

    async reorder(source: TreeAteNode, target: TreeAteNode): Promise<void> {
        if (source.kind !== target.kind || source.tpPath !== target.tpPath || source.suiteIndex !== target.suiteIndex && source.kind === 'case') {
            throw new Error(t('store.reorderSameParent'));
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
        const nodes = this.parameterTableNodes(selection);
        const resolved = nodes.map(node => ({ node, values: this.resolvedParameters(node) }));
        const columns = [...new Set(resolved.flatMap(row => Object.keys(row.values.values)))].sort();
        return {
            columns,
            rows: resolved.map(({ node, values }) => {
                const own = this.ownParameterSource(node);
                return {
                    nodeId: node.id,
                    label: this.parameterRowLabel(node),
                    cells: Object.fromEntries(columns.map(name => [name, {
                        value: values.values[name] ?? '',
                        inherited: values.sources[name] !== own,
                        source: values.sources[name] ?? 'none'
                    }]))
                };
            })
        };
    }

    async setCell(nodeId: string, name: string, value: string): Promise<void> {
        assertParameterNames({ [name]: value });
        const node = this.findNode(nodeId);
        if (!node || node.kind === 'project') { throw new Error(t('store.invalidParameterRow')); }
        const target = this.resolveObject(node)!;
        const params = readParameters(target.Parameter);
        params[name] = value;
        writeParameters(target, params);
        await this.saveByPath(node.tpPath!);
    }

    /** 删除参数列：连同当前表范围内被继承的上级定义一起移除，确保该列从表中消失。 */
    async deleteParameterColumn(selection: TreeAteNode | undefined, name: string): Promise<void> {
        if (!this.snapshot) { throw new Error(t('store.noProject')); }
        if (!selection) { throw new Error(t('store.selectNodeFirst')); }
        assertParameterNames({ [name]: '' });
        const files = new Set<ProjectFile>();
        for (const { owner, file } of this.parameterOwners(selection)) {
            const params = readParameters(owner.Parameter);
            if (!(name in params)) { continue; }
            delete params[name];
            writeParameters(owner, params);
            files.add(file);
        }
        for (const file of files) { await this.save(file); }
    }

    /** 当前参数表范围涉及的参数宿主，包含提供继承值的上级层级。 */
    private parameterOwners(selection: TreeAteNode): Array<{ owner: JsonObject; file: ProjectFile }> {
        const owners: Array<{ owner: JsonObject; file: ProjectFile }> = [];
        if (!this.snapshot) { return owners; }
        const addFile = (file: ProjectFile): void => {
            owners.push({ owner: file.data, file });
            for (const suite of asArray(file.data.TestSuite)) {
                owners.push({ owner: suite, file });
                for (const item of asArray(suite.TestCase)) { owners.push({ owner: item, file }); }
            }
        };
        if (selection.kind === 'project') {
            for (const file of this.snapshot.tpFiles) { addFile(file); }
            return owners;
        }
        const file = selection.tpPath ? this.fileByPath(selection.tpPath) : undefined;
        if (!file) { return owners; }
        owners.push({ owner: file.data, file });
        if (selection.kind === 'tp') {
            for (const suite of asArray(file.data.TestSuite)) {
                owners.push({ owner: suite, file });
                for (const item of asArray(suite.TestCase)) { owners.push({ owner: item, file }); }
            }
            return owners;
        }
        const suite = this.resolveSuite(selection);
        if (suite) { owners.push({ owner: suite, file }); }
        if (selection.kind === 'suite') {
            for (const item of asArray(suite?.TestCase)) { owners.push({ owner: item, file }); }
        } else if (selection.kind === 'case') {
            const item = this.resolveObject(selection);
            if (item) { owners.push({ owner: item, file }); }
        }
        return owners;
    }

    /** 导出整棵测试工程树的参表；只有各层级自身参数，不含继承值。 */
    exportParameterCsv(project: TreeAteNode): string {
        if (!this.snapshot) { throw new Error(t('store.noProject')); }
        if (project.kind !== 'project') { throw new Error(t('store.exportOnlyRoot')); }
        const rows: ParameterCsvInputRow[] = [];
        for (const file of this.snapshot.tpFiles) {
            rows.push({
                depth: 1, name: text(file.data.Name) || path.parse(file.path).name,
                description: text(file.data.Desc), parameters: readParameters(file.data.Parameter)
            });
            asArray(file.data.TestSuite).forEach((suite, suiteIndex) => {
                rows.push({
                    depth: 2, name: this.suiteName(suite, suiteIndex),
                    description: text(suite.Desc), parameters: readParameters(suite.Parameter)
                });
                asArray(suite.TestCase).forEach((item, caseIndex) => rows.push({
                    depth: 3, name: this.caseName(item, caseIndex),
                    description: text(item.Desc), parameters: readParameters(item.Parameter)
                }));
            });
        }
        const columns = [...new Set(rows.flatMap(row => Object.keys(row.parameters)))].sort();
        return serializeParameterCsv(columns, rows);
    }

    /** 先完整校验并映射 CSV，再按文件一次性写回；解析或映射失败时不修改任何文件。 */
    async importParameterCsv(project: TreeAteNode, content: string): Promise<{ files: number; nodes: number }> {
        if (!this.snapshot) { throw new Error(t('store.noProject')); }
        if (project.kind !== 'project') { throw new Error(t('store.importOnlyRoot')); }
        const csv = parseParameterCsv(content);

        const filesByName = new Map<string, ProjectFile>();
        for (const file of this.snapshot.tpFiles) {
            const name = text(file.data.Name) || path.parse(file.path).name;
            if (filesByName.has(name)) { throw new Error(t('store.duplicateProject', name)); }
            filesByName.set(name, file);
        }

        const targets: Array<{ owner: JsonObject; row: ParameterCsvRow; file: ProjectFile }> = [];
        const used = new Set<string>();
        let currentFile: ProjectFile | undefined;
        let currentSuite: JsonObject | undefined;
        let currentSuiteIndex = -1;
        for (const row of csv.rows) {
            if (row.depth === 1) {
                const file = filesByName.get(row.name);
                if (!file) { throw new Error(t('store.csvProjectNotFound', row.line, row.name)); }
                const key = `project:${file.path}`;
                if (used.has(key)) { throw new Error(t('store.csvProjectDuplicate', row.line, row.name)); }
                used.add(key);
                currentFile = file; currentSuite = undefined; currentSuiteIndex = -1;
                targets.push({ owner: file.data, row, file });
                continue;
            }
            if (!currentFile) { throw new Error(t('store.csvMissingProjectBeforeSuite', row.line)); }
            if (row.depth === 2) {
                const matches = asArray(currentFile.data.TestSuite)
                    .map((suite, index) => ({ suite, index }))
                    .filter(entry => this.suiteName(entry.suite, entry.index) === row.name);
                if (!matches.length) { throw new Error(t('store.csvSuiteNotFound', row.line, row.name)); }
                if (matches.length > 1) { throw new Error(t('store.csvSuiteAmbiguous', row.line, row.name)); }
                const key = `suite:${currentFile.path}:${matches[0].index}`;
                if (used.has(key)) { throw new Error(t('store.csvSuiteDuplicate', row.line, row.name)); }
                used.add(key);
                currentSuite = matches[0].suite;
                currentSuiteIndex = matches[0].index;
                targets.push({ owner: matches[0].suite, row, file: currentFile });
                continue;
            }
            if (!currentSuite) { throw new Error(t('store.csvMissingSuiteBeforeCase', row.line)); }
            const matches = asArray(currentSuite.TestCase)
                .map((item, index) => ({ item, index }))
                .filter(entry => this.caseName(entry.item, entry.index) === row.name);
            if (!matches.length) { throw new Error(t('store.csvCaseNotFound', row.line, row.name)); }
            if (matches.length > 1) { throw new Error(t('store.csvCaseAmbiguous', row.line, row.name)); }
            const key = `case:${currentFile.path}:${currentSuiteIndex}:${matches[0].index}`;
            if (used.has(key)) { throw new Error(t('store.csvCaseDuplicate', row.line, row.name)); }
            used.add(key);
            targets.push({ owner: matches[0].item, row, file: currentFile });
        }

        for (const { owner, row } of targets) {
            const parameters = readParameters(owner.Parameter);
            for (const column of csv.columns) { parameters[column] = row.parameters[column] ?? ''; }
            owner.Desc = row.description;
            writeParameters(owner, parameters);
        }
        const touched = new Set(targets.map(target => target.file));
        for (const file of touched) { await this.save(file); }
        return { files: touched.size, nodes: targets.length };
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
        if (!this.snapshot) { throw new Error(t('store.noProject')); }
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
        if (!tpPath) { throw new Error(t('store.noAssociatedTp')); }
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
        const groups: Array<['project' | 'suite' | 'case', Record<string, string>]> = [['project', readParameters(tp.data.Parameter)]];
        if (node.kind !== 'tp') {
            groups.push(['suite', readParameters(this.resolveSuite(node)!.Parameter)]);
        }
        if (node.kind === 'case') {
            groups.push(['case', readParameters(this.resolveObject(node)!.Parameter)]);
        }
        const values: Record<string, string> = {};
        const sources: Record<string, 'project' | 'suite' | 'case'> = {};
        for (const [source, params] of groups) { for (const [key, value] of Object.entries(params)) { values[key] = value; sources[key] = source; } }
        return { values, sources };
    }

    private parameterTableNodes(selection: TreeAteNode): TreeAteNode[] {
        const nodes: TreeAteNode[] = [];
        if (!this.snapshot) { return nodes; }
        if (selection.kind === 'project') {
            const suites = this.getChildren(selection);
            for (const file of this.snapshot.tpFiles) {
                const tp = this.tpNode(file.path);
                if (tp) { nodes.push(tp); }
                for (const suite of suites.filter(item => item.tpPath === file.path)) {
                    nodes.push(suite, ...this.getChildren(suite));
                }
            }
        } else if (selection.kind === 'suite') {
            nodes.push(selection, ...this.getChildren(selection));
        } else if (selection.kind === 'case') {
            nodes.push(selection);
        }
        return nodes;
    }

    private parameterRowLabel(node: TreeAteNode): string {
        if (node.kind === 'tp' || node.kind === 'suite') { return node.name; }
        return `${this.getParent(node)?.name ?? ''} / ${node.name}`;
    }

    private ownParameterSource(node: TreeAteNode): 'project' | 'suite' | 'case' {
        return node.kind === 'tp' ? 'project' : node.kind === 'suite' ? 'suite' : 'case';
    }

    private suiteName(suite: JsonObject, index: number): string {
        return text(suite.Name) || `suite${index + 1}`;
    }

    private caseName(item: JsonObject, index: number): string {
        return text(item.Name) || `test${index + 1}`;
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
        if (!file) { throw new Error(t('store.fileNotFound', filePath)); }
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
        try { data = JSON.parse(content); } catch (error) { throw new Error(t('store.invalidJson', path.basename(filePath), String(error))); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) { throw new Error(t('store.rootNotObject', path.basename(filePath))); }
        return { path: filePath, data: data as JsonObject };
    }

    private watch(rootDir: string): void {
        this.watcher?.dispose();
        const pattern = new vscode.RelativePattern(rootDir, '*.{tp,tpx}');
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const refresh = () => {
            if (Date.now() < this.suppressWatcherUntil) { return; }
            void this.reload().catch(error => vscode.window.showErrorMessage(t('store.refreshFailed', String(error))));
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
