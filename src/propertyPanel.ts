import * as path from 'path';
import * as vscode from 'vscode';
import { JsonObject, TreeAteNode } from './model';
import { ProjectStore } from './projectStore';

export class PropertyPanel implements vscode.Disposable {
    private panel?: vscode.WebviewPanel;
    private selected?: TreeAteNode;
    private readonly subscription: vscode.Disposable;

    constructor(private readonly context: vscode.ExtensionContext, private readonly store: ProjectStore) {
        this.subscription = store.onDidChange(() => this.update());
    }

    show(node: TreeAteNode): void {
        this.selected = node;
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel('treeate.properties', 'TreeATE 属性配置', vscode.ViewColumn.Beside, {
                enableScripts: true, retainContextWhenHidden: true
            });
            this.panel.webview.html = this.html(this.panel.webview);
            this.panel.webview.onDidReceiveMessage(message => void this.receive(message));
            this.panel.onDidDispose(() => { this.panel = undefined; });
        }
        this.panel.title = `TreeATE 属性 · ${node.name}`;
        this.panel.reveal(vscode.ViewColumn.Beside, true);
        this.update();
    }

    showFile(uri: vscode.Uri): void {
        if (uri.fsPath.toLowerCase().endsWith('.tpx')) {
            const root = this.store.rootNode;
            if (root) { this.show(root); }
            return;
        }
        const node = this.store.tpNode(uri.fsPath);
        if (node) { this.show(node); }
    }

    private update(): void {
        if (!this.panel || !this.selected) { return; }
        const refreshed = this.selected.kind === 'tp' ? this.store.tpNode(this.selected.tpPath!) : this.store.findNode(this.selected.id);
        if (!refreshed) { return; }
        this.selected = refreshed;
        void this.panel.webview.postMessage({ type: 'render', data: this.store.getPropertyData(refreshed) });
    }

    private async receive(message: { type?: string; data?: JsonObject }): Promise<void> {
        if (message.type !== 'save' || !message.data || !this.selected) { return; }
        try {
            const filePath = this.selected.kind === 'project' ? this.store.current?.tpx.path : this.selected.tpPath;
            const dirtyDocument = filePath && vscode.workspace.textDocuments.find(document =>
                document.isDirty && path.normalize(document.uri.fsPath).toLowerCase() === path.normalize(filePath).toLowerCase()
            );
            if (dirtyDocument) { throw new Error('左侧 JSON 有未保存的修改，请先保存 JSON 后再保存属性配置。'); }
            await this.store.savePropertyData(this.selected, message.data);
            void this.panel?.webview.postMessage({ type: 'saved' });
            void vscode.window.setStatusBarMessage('TreeATE 配置已保存', 2000);
        } catch (error) {
            void this.panel?.webview.postMessage({ type: 'error', message: String(error) });
            void vscode.window.showErrorMessage(`TreeATE 配置保存失败：${String(error)}`);
        }
    }

    private html(webview: vscode.Webview): string {
        const nonce = Array.from({ length: 24 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]).join('');
        const style = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'webview.css'));
        const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'properties.js'));
        return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${style}"><title>TreeATE 属性</title></head>
<body><header><h2 id="title">TreeATE 属性配置</h2><span id="path"></span></header><main id="app"></main><footer><span id="status"></span><button id="save" class="primary">保存</button></footer><script nonce="${nonce}" src="${script}"></script></body></html>`;
    }

    dispose(): void { this.panel?.dispose(); this.subscription.dispose(); }
}
