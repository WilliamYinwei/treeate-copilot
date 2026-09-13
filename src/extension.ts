import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { EngineRunner } from './engineRunner';
import { JsonObject, TreeAteNode } from './model';
import { ParameterTableView } from './parameterTableView';
import { ProjectStore } from './projectStore';
import { ProjectTreeProvider } from './projectTree';
import { PropertyPanel } from './propertyPanel';
import { ScriptService } from './scriptService';
import { registerTreeAteApiIntelliSense } from './treeAteApiIntelliSense';

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const store = new ProjectStore();
    const treeProvider = new ProjectTreeProvider(store);
    const parameterTable = new ParameterTableView(context, store);
    const propertyPanel = new PropertyPanel(context, store);
    const scripts = new ScriptService(store);
    const runner = new EngineRunner(store);
    const tree = vscode.window.createTreeView('treeate.projectTree', { treeDataProvider: treeProvider, dragAndDropController: treeProvider, showCollapseAll: true });
    let selection: TreeAteNode | undefined;

    context.subscriptions.push(
        store, treeProvider, parameterTable, propertyPanel, runner, tree,
        registerTreeAteApiIntelliSense(),
        vscode.window.registerWebviewViewProvider(ParameterTableView.viewType, parameterTable, { webviewOptions: { retainContextWhenHidden: true } })
    );

    tree.onDidChangeSelection(event => {
        selection = event.selection[0];
        if (!selection) { return; }
        parameterTable.select(selection);
        propertyPanel.show(selection);
        if (selection.kind !== 'project' && vscode.workspace.getConfiguration('treeate').get('openScriptOnSelect', true)) {
            void scripts.open(selection).catch(error => showError('打开脚本失败', error));
        }
    }, undefined, context.subscriptions);

    let activeFileRequest = 0;
    const showPropertiesForEditor = async (editor?: vscode.TextEditor): Promise<void> => {
        const request = ++activeFileRequest;
        const uri = editor?.document.uri;
        if (!uri || uri.scheme !== 'file' || !/\.(?:tp|tpx)$/i.test(uri.fsPath)) { return; }
        try {
            const rootDir = path.dirname(uri.fsPath);
            if (!store.current || path.normalize(store.current.rootDir).toLowerCase() !== path.normalize(rootDir).toLowerCase()) {
                await store.open(rootDir);
            }
            if (request === activeFileRequest) { propertyPanel.showFile(uri); }
        } catch (error) {
            if (request === activeFileRequest) { showError('自动打开属性面板失败', error); }
        }
    };
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => void showPropertiesForEditor(editor)));

    const nodeArg = (candidate?: TreeAteNode): TreeAteNode | undefined => candidate?.kind ? candidate : selection;
    const register = (name: string, handler: (...args: any[]) => unknown) => context.subscriptions.push(vscode.commands.registerCommand(name, handler));

    register('treeate.newProject', async (uri?: vscode.Uri) => {
        try {
            const projectDir = await createProject(uri);
            if (projectDir) {
                await addWorkspaceFolder(projectDir);
                await store.open(projectDir);
                void vscode.window.showInformationMessage(`TreeATE 工程已创建：${path.basename(projectDir)}`);
            }
        } catch (error) { showError('新建工程失败', error); }
    });

    register('treeate.openProject', async () => {
        const chosen = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, title: '选择 TreeATE 工程根目录', openLabel: '打开工程' });
        if (!chosen?.[0]) { return; }
        try { await addWorkspaceFolder(chosen[0].fsPath); await store.open(chosen[0].fsPath); }
        catch (error) { showError('打开工程失败', error); }
    });

    register('treeate.refresh', async () => {
        try { await store.reload(); } catch (error) { showError('刷新失败', error); }
    });

    register('treeate.addChild', async (candidate?: TreeAteNode) => {
        const parent = nodeArg(candidate);
        if (!parent) { return; }
        const name = await askNodeName(parent.kind === 'project' ? '测试套' : '测试项');
        if (!name) { return; }
        try {
            const created = await store.addChild(parent, name);
            await tree.reveal(created, { select: true, focus: true, expand: true });
        } catch (error) { showError('新增节点失败', error); }
    });

    register('treeate.insertSibling', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate);
        if (!node) { return; }
        const name = await askNodeName(node.kind === 'suite' ? '测试套' : '测试项');
        if (!name) { return; }
        try { await store.insertSibling(node, name); } catch (error) { showError('插入节点失败', error); }
    });

    register('treeate.renameNode', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate);
        if (!node) { return; }
        const name = await vscode.window.showInputBox({ title: '重命名', value: node.name, validateInput: validateName });
        if (!name || name === node.name) { return; }
        try { await store.rename(node, name); } catch (error) { showError('重命名失败', error); }
    });

    register('treeate.deleteNode', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate);
        if (!node || node.kind === 'project') { return; }
        const confirm = await vscode.window.showWarningMessage(`确定删除“${node.name}”及其下级内容吗？`, { modal: true }, '删除');
        if (confirm !== '删除') { return; }
        try { await store.delete(node); } catch (error) { showError('删除失败', error); }
    });

    register('treeate.importResource', async (candidate?: TreeAteNode | vscode.Uri) => {
        const uri = candidate instanceof vscode.Uri ? candidate : undefined;
        try { await importResources(store, uri); } catch (error) { showError('导入资源失败', error); }
    });

    register('treeate.openProperties', async (candidate?: TreeAteNode | vscode.Uri) => {
        if (candidate instanceof vscode.Uri) {
            try {
                if (!store.current || !isWithin(store.current.rootDir, candidate.fsPath)) { await store.open(path.dirname(candidate.fsPath)); }
                propertyPanel.showFile(candidate);
            } catch (error) { showError('打开属性面板失败', error); }
            return;
        }
        const node = nodeArg(candidate);
        if (node) { propertyPanel.show(node); }
    });

    register('treeate.openScript', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate); if (node) { try { await scripts.open(node); } catch (error) { showError('打开脚本失败', error); } }
    });
    register('treeate.openSetup', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate); if (node) { try { await scripts.open(node, 'setup'); } catch (error) { showError('打开 setup 失败', error); } }
    });
    register('treeate.openTeardown', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate); if (node) { try { await scripts.open(node, 'teardown'); } catch (error) { showError('打开 teardown 失败', error); } }
    });
    register('treeate.generateFunctions', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate); if (node) { try { await scripts.generate(node); } catch (error) { showError('生成函数失败', error); } }
    });
    register('treeate.runProject', async () => { try { await runner.run(); } catch (error) { showError('运行失败', error); } });

    await tryOpenWorkspaceProject(store);
    void showPropertiesForEditor(vscode.window.activeTextEditor);
}

async function tryOpenWorkspaceProject(store: ProjectStore): Promise<void> {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        try {
            const entries = await fs.readdir(folder.uri.fsPath);
            if (entries.some(name => name.toLowerCase().endsWith('.tpx'))) { await store.open(folder.uri.fsPath); return; }
        } catch { /* another workspace folder may be a TreeATE project */ }
    }
    await vscode.commands.executeCommand('setContext', 'treeate.projectOpen', false);
}

async function createProject(contextUri?: vscode.Uri): Promise<string | undefined> {
    const name = await vscode.window.showInputBox({ title: '新建 TreeATE 工程', prompt: '输入工程名称', placeHolder: 'TestProject', validateInput: validateName });
    if (!name) { return undefined; }
    const description = await vscode.window.showInputBox({ title: '工程描述', value: name });
    if (description === undefined) { return undefined; }
    let parent: string | undefined;
    if (contextUri) {
        const stat = await fs.stat(contextUri.fsPath);
        parent = stat.isDirectory() ? contextUri.fsPath : path.dirname(contextUri.fsPath);
    } else {
        const chosen = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, title: '选择工程保存位置', openLabel: '选择文件夹' });
        parent = chosen?.[0]?.fsPath;
    }
    if (!parent) { return undefined; }
    const root = path.join(parent, name);
    try { await fs.access(root); throw new Error(`目标目录已存在：${root}`); } catch (error) {
        if (error instanceof Error && error.message.startsWith('目标目录已存在')) { throw error; }
    }
    await fs.mkdir(path.join(root, 'libs'), { recursive: true });
    await fs.mkdir(path.join(root, 'images'), { recursive: true });
    await fs.writeFile(path.join(root, `${name}.tp`), `${JSON.stringify(buildTp(name, description), null, 4)}\n`, 'utf8');
    await fs.writeFile(path.join(root, `${name}.tpx`), `${JSON.stringify(buildTpx(name, description), null, 4)}\n`, 'utf8');
    await fs.writeFile(path.join(root, `${name}.py`), scriptTemplate(name), 'utf8');
    return root;
}

function buildTp(name: string, description: string): JsonObject {
    const lower = name.toLowerCase();
    return {
        Desc: description, Name: lower, Parameter: {},
        Public: {
            Models: [],
            Parameter: [
                { Desc: '测试套启动返回值', Name: 'g_rstSetupSuite', Value: '0' },
                { Desc: '测试套退出返回值', Name: 'g_rstExitSuite', Value: '0' },
                { Desc: '测试项返回值', Name: 'g_rstTest', Value: '0' }
            ]
        },
        TestSuite: [{ Desc: '默认测试套', Name: 'suite1', Parameter: {}, TestCase: [{ Desc: '默认测试项', Name: 'test1', Parameter: {} }] }],
        // TreeATE V2.4 desktop uses the 2.1.0 TP JSON schema marker.
        Ver: '2.1.0'
    };
}

function buildTpx(name: string, description: string): JsonObject {
    return {
        Desc: description, Name: name.toLowerCase(), LoopCount: 1, failedToStop: true,
        stoppedForLoop: false, BarCodeReg: '', GUIPlugins: [{ Com: 'GUI_TA_MsgBox.dll', Name: 'msg' }],
        Instance: [{ File: `${name}.tp`, Name: name, Parameter: [] }]
    };
}

function scriptTemplate(name: string): string {
    const project = name.toLowerCase();
    return `#coding:utf-8\n\ndef setup_${project}():\n    \"\"\"工程启动。\"\"\"\n    __ate.OutputError(\"setup_${project}\")\n    return 0\n\ndef teardown_${project}():\n    \"\"\"工程退出。\"\"\"\n    __ate.OutputError(\"teardown_${project}\")\n    return 0\n\ndef setup_suite1():\n    return int(g_rstSetupSuite)\n\ndef teardown_suite1():\n    return int(g_rstExitSuite)\n\ndef test_test1():\n    # TODO: 在此实现测试逻辑\n    return int(g_rstTest)\n`;
}

async function importResources(store: ProjectStore, contextUri?: vscode.Uri): Promise<void> {
    let root = store.current?.rootDir;
    if (!root && contextUri) { root = contextUri.fsPath; }
    if (!root) { throw new Error('请先打开 TreeATE 工程。'); }
    const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true, canSelectFolders: false, canSelectMany: true, title: '导入 TreeATE 资源',
        filters: { 'TreeATE 资源': ['dll', 'py', 'js', 'png', 'jpg', 'jpeg', 'gif'] }
    });
    if (!selected?.length) { return; }
    for (const source of selected) {
        const extension = path.extname(source.fsPath).toLowerCase();
        const folder = ['.png', '.jpg', '.jpeg', '.gif'].includes(extension) ? 'images' : 'libs';
        const targetDir = path.join(root, folder); await fs.mkdir(targetDir, { recursive: true });
        const target = path.join(targetDir, path.basename(source.fsPath));
        let exists = false; try { await fs.access(target); exists = true; } catch { /* available */ }
        if (exists) {
            const answer = await vscode.window.showWarningMessage(`${path.basename(target)} 已存在，是否覆盖？`, { modal: true }, '覆盖');
            if (answer !== '覆盖') { continue; }
        }
        await fs.copyFile(source.fsPath, target);
    }
    void vscode.window.showInformationMessage(`资源已导入 ${root}`);
}

async function addWorkspaceFolder(folder: string): Promise<void> {
    if ((vscode.workspace.workspaceFolders ?? []).some(item => path.normalize(item.uri.fsPath).toLowerCase() === path.normalize(folder).toLowerCase())) { return; }
    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders?.length ?? 0, 0, { uri: vscode.Uri.file(folder), name: path.basename(folder) });
}

async function askNodeName(kind: string): Promise<string | undefined> {
    return vscode.window.showInputBox({ title: `新增${kind}`, prompt: `输入${kind}名称`, placeHolder: kind === '测试项' ? 'login_ok' : 'login', validateInput: validateName });
}

function validateName(value: string): string | undefined {
    return NAME_PATTERN.test(value) ? undefined : '必须以字母开头，且只能包含字母、数字和下划线。';
}

function isWithin(root: string, candidate: string): boolean {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function showError(prefix: string, error: unknown): void {
    void vscode.window.showErrorMessage(`${prefix}：${error instanceof Error ? error.message : String(error)}`);
}

export function deactivate(): void { /* subscriptions are disposed by VS Code */ }
