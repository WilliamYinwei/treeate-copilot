import * as vscode from 'vscode';
import { t, webviewStrings } from './i18n';
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

    /** 语言设置变更后重建静态 HTML，并按当前选择重新推送数据。 */
    refreshLanguage(): void {
        if (this.view) { this.view.webview.html = this.html(this.view.webview); }
        this.update();
    }

    private update(): void {
        void this.view?.webview.postMessage({ type: 'render', title: this.selection?.name ?? '', data: this.store.getParameterTable(this.selection) });
    }

    private async receive(message: { type?: string; nodeId?: string; name?: string; value?: string }): Promise<void> {
        if (message.type === 'deleteColumn' && message.name) {
            const deleteLabel = t('common.delete');
            const confirm = await vscode.window.showWarningMessage(t('paramTable.deleteColumnConfirm', message.name), { modal: true }, deleteLabel);
            if (confirm !== deleteLabel) { return; }
            try { await this.store.deleteParameterColumn(this.selection, message.name); }
            catch (error) { void vscode.window.showErrorMessage(t('paramTable.deleteColumnFailed', String(error))); }
            this.update();
            return;
        }
        if (message.type !== 'setCell' || !message.nodeId || !message.name) { return; }
        try { await this.store.setCell(message.nodeId, message.name, String(message.value ?? '')); }
        catch (error) { void vscode.window.showErrorMessage(t('paramTable.saveFailed', String(error))); this.update(); }
    }

    private html(webview: vscode.Webview): string {
        const nonce = nonceValue();
        const style = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'webview.css'));
        const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'parameterTable.js'));
        const strings = webviewStrings();
        const locale = JSON.stringify(strings).replace(/</g, '\\u003c');
        return `<!doctype html><html lang="${strings.language}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${style}"></head>
<body><div id="empty" class="empty">${strings.parameterTable.empty}</div><div id="table"></div><script nonce="${nonce}">window.__treeateI18n=${locale};</script><script nonce="${nonce}" src="${script}"></script></body></html>`;
    }

    dispose(): void { this.subscription.dispose(); }
}

function nonceValue(): string { return Array.from({ length: 24 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join(''); }
