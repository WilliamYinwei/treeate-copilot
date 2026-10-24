import * as path from 'path';
import * as vscode from 'vscode';
import { DllInspection, DllInspector } from './dllInspector';

const BINARY_MESSAGE = 'The file is not displayed in the text editor because it is either binary or uses an unsupported text encoding.';

class DllDocument implements vscode.CustomDocument {
    constructor(readonly uri: vscode.Uri) {}
    dispose(): void { /* no resources are held by the document */ }
}

export class DllEditorProvider implements vscode.CustomReadonlyEditorProvider<DllDocument> {
    static readonly viewType = 'treeate.dllFunctions';
    private readonly inspector: DllInspector;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.inspector = new DllInspector(context);
    }

    openCustomDocument(uri: vscode.Uri): DllDocument {
        return new DllDocument(uri);
    }

    async resolveCustomEditor(document: DllDocument, panel: vscode.WebviewPanel, token: vscode.CancellationToken): Promise<void> {
        panel.webview.options = { enableScripts: false };
        panel.webview.html = this.loadingHtml(panel.webview, document.uri);
        if (!isLibraryDll(document.uri)) {
            panel.webview.html = this.resultHtml(panel.webview, document.uri, { status: 'unsupported' });
            return;
        }
        const result = await this.inspector.inspect(document.uri.fsPath);
        if (!token.isCancellationRequested) { panel.webview.html = this.resultHtml(panel.webview, document.uri, result); }
    }

    private loadingHtml(webview: vscode.Webview, uri: vscode.Uri): string {
        return this.page(webview, `<div class="empty">正在读取 ${escapeHtml(path.basename(uri.fsPath))} 的 Qt 元对象信息…</div>`);
    }

    private resultHtml(webview: vscode.Webview, uri: vscode.Uri, result: DllInspection): string {
        if (result.status === 'unsupported') {
            return this.page(webview, `<div class="empty">${BINARY_MESSAGE}</div>`);
        }
        if (result.status === 'error') {
            return this.page(webview, `<div class="empty">${BINARY_MESSAGE}<p class="error">${escapeHtml(result.message)}</p></div>`);
        }
        const rows = result.methods.map(method => {
            const parameters = method.parameters.length
                ? method.parameters.map(parameter => escapeHtml(parameter.name || '（未命名）')).join(', ')
                : '—';
            return `<tr><td><code>${escapeHtml(method.name)}</code></td><td>${parameters}</td><td><code>${escapeHtml(method.signature)}</code></td></tr>`;
        }).join('');
        const content = `<header><h2>${escapeHtml(path.basename(uri.fsPath))}</h2><span id="path">${escapeHtml(uri.fsPath)}</span></header>
<main><div class="section"><div class="field"><strong>QObject 类名</strong><span>${escapeHtml(result.className || 'QObject')}</span></div></div>
${rows ? `<div class="table-wrap"><table><thead><tr><th>函数名</th><th>参数名</th><th>Qt 方法签名</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">CreateDeviceInst 已返回 QObject*，但该对象没有声明可调用的 Qt 方法。</div>'}</main>`;
        return this.page(webview, content);
    }

    private page(webview: vscode.Webview, body: string): string {
        const style = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'webview.css'));
        return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource};"><link rel="stylesheet" href="${style}"><title>TreeATE DLL 接口</title></head><body>${body}</body></html>`;
    }
}

function isLibraryDll(uri: vscode.Uri): boolean {
    return uri.scheme === 'file'
        && path.extname(uri.fsPath).toLowerCase() === '.dll'
        && path.basename(path.dirname(uri.fsPath)).toLowerCase() === 'libs';
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
