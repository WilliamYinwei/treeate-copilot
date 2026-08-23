import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { TreeAteNode } from './model';
import { ProjectStore } from './projectStore';

export class ScriptService {
    constructor(private readonly store: ProjectStore) {}

    async open(node: TreeAteNode, requested?: 'setup' | 'teardown'): Promise<void> {
        const scriptPath = this.store.associatedScript(node);
        const names = this.store.functionNames(node);
        const desired = requested ? names.find(name => name.startsWith(`${requested}_`)) ?? names[0] : names[0];
        await this.ensure(scriptPath, node, names);
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(scriptPath));
        const editor = await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.One, preserveFocus: false });
        const escaped = desired.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = new RegExp(`^\\s*(?:async\\s+)?def\\s+${escaped}\\s*\\(`, 'm').exec(document.getText());
        if (match) {
            const position = document.positionAt(match.index);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
    }

    async generate(node: TreeAteNode): Promise<void> {
        const scriptPath = this.store.associatedScript(node);
        await this.ensure(scriptPath, node, this.store.functionNames(node));
        await this.open(node);
    }

    private async ensure(scriptPath: string, node: TreeAteNode, names: string[]): Promise<void> {
        let content = '';
        try { content = await fs.readFile(scriptPath, 'utf8'); } catch { content = '#coding:utf-8\n'; }
        const missing = names.filter(name => !new RegExp(`^\\s*(?:async\\s+)?def\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`, 'm').test(content));
        if (!missing.length) { return; }
        const blocks = missing.map(name => `\ndef ${name}():\n    \"\"\"TreeATE ${node.kind}: ${node.name}\"\"\"\n    __ate.OutputError(\"${name}\")\n    # TODO: 在此实现测试逻辑\n    return 0\n`).join('');
        await fs.mkdir(path.dirname(scriptPath), { recursive: true });
        await fs.writeFile(scriptPath, `${content.trimEnd()}\n${blocks}`, 'utf8');
        void vscode.window.showInformationMessage(`已在 ${path.basename(scriptPath)} 生成：${missing.join('、')}`);
    }
}
