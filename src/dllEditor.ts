import * as path from 'path';
import * as vscode from 'vscode';
import { DllInspection, DllInspector } from './dllInspector';
import { currentLanguage, t } from './i18n';

class DllDocument implements vscode.CustomDocument {
    constructor(readonly uri: vscode.Uri) {}
    dispose(): void { /* no resources are held by the document */ }
}

export class DllEditorProvider implements vscode.CustomReadonlyEditorProvider<DllDocument> {
    static readonly viewType = 'treeate.dllFunctions';
    private readonly inspector: DllInspector;
    private readonly panels = new Map<vscode.WebviewPanel, { uri: vscode.Uri; result?: DllInspection }>();

    constructor(private readonly context: vscode.ExtensionContext) {
        this.inspector = new DllInspector(context);
    }

    openCustomDocument(uri: vscode.Uri): DllDocument {
        return new DllDocument(uri);
    }

    async resolveCustomEditor(document: DllDocument, panel: vscode.WebviewPanel, token: vscode.CancellationToken): Promise<void> {
        const state: { uri: vscode.Uri; result?: DllInspection } = { uri: document.uri };
        this.panels.set(panel, state);
        panel.onDidDispose(() => this.panels.delete(panel));
        panel.webview.options = { enableScripts: false };
        panel.webview.html = this.loadingHtml(panel.webview, document.uri);
        if (!isLibraryDll(document.uri)) {
            state.result = { status: 'unsupported' };
            panel.webview.html = this.resultHtml(panel.webview, document.uri, state.result);
            return;
        }
        const result = await this.inspector.inspect(document.uri.fsPath);
        if (!token.isCancellationRequested) {
            state.result = result;
            panel.webview.html = this.resultHtml(panel.webview, document.uri, result);
        }
    }

    /** 语言设置变更后，按缓存结果重绘已打开的 DLL 接口页。 */
    refreshLanguage(): void {
        for (const [panel, state] of this.panels) {
            panel.webview.html = state.result
                ? this.resultHtml(panel.webview, state.uri, state.result)
                : this.loadingHtml(panel.webview, state.uri);
        }
    }

    private loadingHtml(webview: vscode.Webview, uri: vscode.Uri): string {
        return this.page(webview, `<div class="empty">${t('dllEditor.loading', escapeHtml(path.basename(uri.fsPath)))}</div>`);
    }

    private resultHtml(webview: vscode.Webview, uri: vscode.Uri, result: DllInspection): string {
        if (result.status === 'unsupported') {
            return this.page(webview, `<div class="empty">${t('dllEditor.binaryMessage')}</div>`);
        }
        if (result.status === 'error') {
            return this.page(webview, `<div class="empty">${t('dllEditor.binaryMessage')}<p class="error">${escapeHtml(result.message)}</p></div>`);
        }
        const rows = result.methods.map(method => {
            const parameters = method.parameters.length
                ? method.parameters.map(parameter => escapeHtml(parameter.name || t('dllEditor.unnamed'))).join(', ')
                : '—';
            return `<tr><td><code>${escapeHtml(method.name)}</code></td><td>${parameters}</td><td><code>${escapeHtml(method.signature)}</code></td></tr>`;
        }).join('');
        const content = `<header><h2>${escapeHtml(path.basename(uri.fsPath))}</h2><span id="path">${escapeHtml(uri.fsPath)}</span></header>
<main><div class="section"><div class="field"><strong>${t('dllEditor.className')}</strong><span>${escapeHtml(result.className || 'QObject')}</span></div></div>
${rows ? `<div class="table-wrap"><table><thead><tr><th>${t('dllEditor.functionName')}</th><th>${t('dllEditor.parameterName')}</th><th>${t('dllEditor.methodSignature')}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty">${t('dllEditor.noMethods')}</div>`}</main>`;
        return this.page(webview, content);
    }

    private page(webview: vscode.Webview, body: string): string {
        const style = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'webview.css'));
        return `<!doctype html><html lang="${currentLanguage()}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource};"><link rel="stylesheet" href="${style}"><title>${t('dllEditor.pageTitle')}</title></head><body>${body}</body></html>`;
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
