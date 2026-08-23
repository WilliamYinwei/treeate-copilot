import * as vscode from 'vscode';
import { TreeAteNode } from './model';
import { ProjectStore } from './projectStore';

export class ParameterTableView implements vscode.WebviewViewProvider, vscode.Disposable {
    static readonly viewType = 'treeate.parameterTable';
    private view?: vscode.WebviewView;
    private selection?: TreeAteNode;
    private readonly subscription: vscode.Disposable;

    constructor(private readonly context: vscode.ExtensionContext, private readonly store: ProjectStore) {
        this.subscription = store.onDidChange(() => this.update());
    }

    resolveWebviewView(view: vscode.WebviewView): void {
        this.view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = this.html(view.webview);
        view.webview.onDidReceiveMessage(message => void this.receive(message));
        this.update();
    }

    select(node: TreeAteNode): void { this.selection = node; this.update(); }

    private update(): void {
        void this.view?.webview.postMessage({ type: 'render', title: this.selection?.name ?? '', data: this.store.getParameterTable(this.selection) });
    }

    private async receive(message: { type?: string; nodeId?: string; name?: string; value?: string }): Promise<void> {
        if (message.type !== 'setCell' || !message.nodeId || !message.name) { return; }
        try { await this.store.setCell(message.nodeId, message.name, String(message.value ?? '')); }
        catch (error) { void vscode.window.showErrorMessage(`参数保存失败：${String(error)}`); this.update(); }
    }

    private html(webview: vscode.Webview): string {
        const nonce = nonceValue();
        const style = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'webview.css'));
        const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'parameterTable.js'));
        return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${style}"></head>
<body><div id="empty" class="empty">选择节点后显示参数矩阵</div><div id="table"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
    }

    dispose(): void { this.subscription.dispose(); }
}

function nonceValue(): string { return Array.from({ length: 24 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join(''); }
