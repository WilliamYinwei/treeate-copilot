import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { DllEditorProvider } from './dllEditor';
import { EngineRunner } from './engineRunner';
import { t } from './i18n';
import { JsonObject, TreeAteNode } from './model';
import { ParameterTableView } from './parameterTableView';
import { decodeCsvBuffer } from './parameterTableCsv';
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
    const dllEditor = new DllEditorProvider(context);
    const tree = vscode.window.createTreeView('treeate.projectTree', { treeDataProvider: treeProvider, dragAndDropController: treeProvider, showCollapseAll: true });
    let selection: TreeAteNode | undefined;

    context.subscriptions.push(
        store, treeProvider, parameterTable, propertyPanel, runner, tree,
        registerTreeAteApiIntelliSense(),
        vscode.window.registerCustomEditorProvider(DllEditorProvider.viewType, dllEditor, {
            supportsMultipleEditorsPerDocument: true
        }),
        vscode.window.registerWebviewViewProvider(ParameterTableView.viewType, parameterTable, { webviewOptions: { retainContextWhenHidden: true } })
    );

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (!event.affectsConfiguration('treeate.language')) { return; }
        treeProvider.refresh();
        parameterTable.refreshLanguage();
        propertyPanel.refreshLanguage();
        dllEditor.refreshLanguage();
    }));

    tree.onDidChangeSelection(event => {
        selection = event.selection[0];
        if (!selection) { return; }
        parameterTable.select(selection);
        propertyPanel.show(selection);
        if (selection.kind !== 'project' && vscode.workspace.getConfiguration('treeate').get('openScriptOnSelect', true)) {
            void scripts.open(selection).catch(error => showError(t('ext.openScriptFailed'), error));
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
            if (request === activeFileRequest) { showError(t('ext.autoOpenPropertiesFailed'), error); }
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
                void vscode.window.showInformationMessage(t('ext.projectCreated', path.basename(projectDir)));
            }
        } catch (error) { showError(t('ext.newProjectFailed'), error); }
    });

    register('treeate.openProject', async () => {
        const chosen = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, title: t('ext.selectProjectRoot'), openLabel: t('ext.openProjectLabel') });
        if (!chosen?.[0]) { return; }
        try { await addWorkspaceFolder(chosen[0].fsPath); await store.open(chosen[0].fsPath); }
        catch (error) { showError(t('ext.openProjectFailed'), error); }
    });

    register('treeate.refresh', async () => {
        try { await store.reload(); } catch (error) { showError(t('ext.refreshFailed'), error); }
    });

    register('treeate.expandAll', async () => {
        const expandChildren = async (node?: TreeAteNode): Promise<void> => {
            for (const child of await treeProvider.getChildren(node)) {
                if (!(await treeProvider.getChildren(child)).length) { continue; }
                await tree.reveal(child, { expand: true, select: false, focus: false });
                await expandChildren(child);
            }
        };
        await expandChildren();
    });

    register('treeate.addChild', async (candidate?: TreeAteNode) => {
        const parent = nodeArg(candidate);
        if (!parent) { return; }
        const name = await askNodeName(parent.kind === 'project' ? 'suite' : 'case');
        if (!name) { return; }
        try {
            const created = await store.addChild(parent, name);
            await tree.reveal(created, { select: true, focus: true, expand: true });
        } catch (error) { showError(t('ext.addNodeFailed'), error); }
    });

    register('treeate.insertSibling', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate);
        if (!node) { return; }
        const name = await askNodeName(node.kind === 'suite' ? 'suite' : 'case');
        if (!name) { return; }
        try { await store.insertSibling(node, name); } catch (error) { showError(t('ext.insertNodeFailed'), error); }
    });

    register('treeate.renameNode', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate);
        if (!node) { return; }
        const name = await vscode.window.showInputBox({ title: t('ext.renameTitle'), value: node.name, validateInput: validateName });
        if (!name || name === node.name) { return; }
        try { await store.rename(node, name); } catch (error) { showError(t('ext.renameFailed'), error); }
    });

    register('treeate.deleteNode', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate);
        if (!node || node.kind === 'project') { return; }
        const deleteLabel = t('common.delete');
        const confirm = await vscode.window.showWarningMessage(t('ext.deleteNodeConfirm', node.name), { modal: true }, deleteLabel);
        if (confirm !== deleteLabel) { return; }
        try { await store.delete(node); } catch (error) { showError(t('ext.deleteFailed'), error); }
    });

    register('treeate.importResource', async (candidate?: TreeAteNode | vscode.Uri) => {
        const uri = candidate instanceof vscode.Uri ? candidate : undefined;
        try { await importResources(store, uri); } catch (error) { showError(t('ext.importResourceFailed'), error); }
    });

    const projectNode = (candidate?: TreeAteNode): TreeAteNode | undefined => {
        const node = nodeArg(candidate);
        if (!node || node.kind !== 'project' || !store.current) {
            void vscode.window.showWarningMessage(t('ext.selectProjectRootWarning'));
            return undefined;
        }
        return node;
    };

    register('treeate.importParameterCsv', async (candidate?: TreeAteNode) => {
        const node = projectNode(candidate);
        if (!node) { return; }
        const selected = await vscode.window.showOpenDialog({
            canSelectFiles: true, canSelectFolders: false, canSelectMany: false,
            title: t('ext.importCsvTitle'), openLabel: t('ext.importLabel'), filters: { CSV: ['csv'] }
        });
        if (!selected?.[0]) { return; }
        try {
            const content = decodeCsvBuffer(await fs.readFile(selected[0].fsPath));
            const result = await store.importParameterCsv(node, content);
            void vscode.window.showInformationMessage(t('ext.csvImported', result.nodes, result.files));
        } catch (error) { showError(t('ext.importCsvFailed'), error); }
    });

    register('treeate.exportParameterCsv', async (candidate?: TreeAteNode) => {
        const node = projectNode(candidate);
        if (!node) { return; }
        try {
            const content = store.exportParameterCsv(node);
            const fileName = `${node.name.replace(/[\\/:*?"<>|]/g, '_')}-parameter.csv`;
            const target = await vscode.window.showSaveDialog({
                title: t('ext.exportCsvTitle'), saveLabel: t('ext.exportLabel'), filters: { CSV: ['csv'] },
                defaultUri: vscode.Uri.file(path.join(store.current!.rootDir, fileName))
            });
            if (!target) { return; }
            await fs.writeFile(target.fsPath, content, 'utf8');
            void vscode.window.showInformationMessage(t('ext.csvExported', target.fsPath));
        } catch (error) { showError(t('ext.exportCsvFailed'), error); }
    });

    register('treeate.openProperties', async (candidate?: TreeAteNode | vscode.Uri) => {
        if (candidate instanceof vscode.Uri) {
            try {
                if (!store.current || !isWithin(store.current.rootDir, candidate.fsPath)) { await store.open(path.dirname(candidate.fsPath)); }
                propertyPanel.showFile(candidate);
            } catch (error) { showError(t('ext.openPropertiesFailed'), error); }
            return;
        }
        const node = nodeArg(candidate);
        if (node) { propertyPanel.show(node); }
    });

    register('treeate.openScript', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate); if (node) { try { await scripts.open(node); } catch (error) { showError(t('ext.openScriptFailed'), error); } }
    });
    register('treeate.openSetup', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate); if (node) { try { await scripts.open(node, 'setup'); } catch (error) { showError(t('ext.openSetupFailed'), error); } }
    });
    register('treeate.openTeardown', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate); if (node) { try { await scripts.open(node, 'teardown'); } catch (error) { showError(t('ext.openTeardownFailed'), error); } }
    });
    register('treeate.generateFunctions', async (candidate?: TreeAteNode) => {
        const node = nodeArg(candidate); if (node) { try { await scripts.generate(node); } catch (error) { showError(t('ext.generateFunctionsFailed'), error); } }
    });
    register('treeate.runProject', async () => { try { await runner.run(); } catch (error) { showError(t('ext.runFailed'), error); } });

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
    const name = await vscode.window.showInputBox({ title: t('ext.newProjectTitle'), prompt: t('ext.projectNamePrompt'), placeHolder: 'TestProject', validateInput: validateName });
    if (!name) { return undefined; }
    const description = await vscode.window.showInputBox({ title: t('ext.projectDescriptionTitle'), value: name });
    if (description === undefined) { return undefined; }
    let parent: string | undefined;
    if (contextUri) {
        const stat = await fs.stat(contextUri.fsPath);
        parent = stat.isDirectory() ? contextUri.fsPath : path.dirname(contextUri.fsPath);
    } else {
        const chosen = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, title: t('ext.selectProjectLocation'), openLabel: t('ext.selectFolderLabel') });
        parent = chosen?.[0]?.fsPath;
    }
    if (!parent) { return undefined; }
    const root = path.join(parent, name);
    const targetExistsPrefix = t('ext.targetExistsPrefix');
    try { await fs.access(root); throw new Error(t('ext.targetExists', root)); } catch (error) {
        if (error instanceof Error && error.message.startsWith(targetExistsPrefix)) { throw error; }
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
                { Desc: t('ext.setupReturnDesc'), Name: 'g_rstSetupSuite', Value: '0' },
                { Desc: t('ext.exitReturnDesc'), Name: 'g_rstExitSuite', Value: '0' },
                { Desc: t('ext.caseReturnDesc'), Name: 'g_rstTest', Value: '0' }
            ]
        },
        TestSuite: [{ Desc: t('ext.defaultSuiteDesc'), Name: 'suite1', Parameter: {}, TestCase: [{ Desc: t('ext.defaultCaseDesc'), Name: 'test1', Parameter: {} }] }],
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
    if (!root) { throw new Error(t('ext.openProjectRequired')); }
    const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true, canSelectFolders: false, canSelectMany: true, title: t('ext.importResourceTitle'),
        filters: { [t('ext.resourceFilter')]: ['dll', 'py', 'js', 'png', 'jpg', 'jpeg', 'gif'] }
    });
    if (!selected?.length) { return; }
    for (const source of selected) {
        const extension = path.extname(source.fsPath).toLowerCase();
        const folder = ['.png', '.jpg', '.jpeg', '.gif'].includes(extension) ? 'images' : 'libs';
        const targetDir = path.join(root, folder); await fs.mkdir(targetDir, { recursive: true });
        const target = path.join(targetDir, path.basename(source.fsPath));
        let exists = false; try { await fs.access(target); exists = true; } catch { /* available */ }
        if (exists) {
            const overwrite = t('ext.overwriteLabel');
            const answer = await vscode.window.showWarningMessage(t('ext.overwriteConfirm', path.basename(target)), { modal: true }, overwrite);
            if (answer !== overwrite) { continue; }
        }
        await fs.copyFile(source.fsPath, target);
    }
    void vscode.window.showInformationMessage(t('ext.resourcesImported', root));
}

async function addWorkspaceFolder(folder: string): Promise<void> {
    if ((vscode.workspace.workspaceFolders ?? []).some(item => path.normalize(item.uri.fsPath).toLowerCase() === path.normalize(folder).toLowerCase())) { return; }
    vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders?.length ?? 0, 0, { uri: vscode.Uri.file(folder), name: path.basename(folder) });
}

async function askNodeName(kind: 'suite' | 'case'): Promise<string | undefined> {
    const label = kind === 'case' ? t('ext.case') : t('ext.suite');
    return vscode.window.showInputBox({ title: t('ext.addNodeTitle', label), prompt: t('ext.addNodePrompt', label), placeHolder: kind === 'case' ? 'login_ok' : 'login', validateInput: validateName });
}

function validateName(value: string): string | undefined {
    return NAME_PATTERN.test(value) ? undefined : t('ext.namePattern');
}

function isWithin(root: string, candidate: string): boolean {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function showError(prefix: string, error: unknown): void {
    void vscode.window.showErrorMessage(t('ext.errorMessage', prefix, error instanceof Error ? error.message : String(error)));
}

export function deactivate(): void { /* subscriptions are disposed by VS Code */ }
