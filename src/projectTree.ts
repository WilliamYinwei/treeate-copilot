import * as vscode from 'vscode';
import { t } from './i18n';
import { TreeAteNode } from './model';
import { ProjectStore } from './projectStore';

const TREE_MIME = 'application/vnd.code.treeate.projecttree';

export class ProjectTreeProvider implements vscode.TreeDataProvider<TreeAteNode>, vscode.TreeDragAndDropController<TreeAteNode>, vscode.Disposable {
    private readonly emitter = new vscode.EventEmitter<TreeAteNode | undefined>();
    readonly onDidChangeTreeData = this.emitter.event;
    readonly dragMimeTypes = [TREE_MIME];
    readonly dropMimeTypes = [TREE_MIME];
    private readonly storeSubscription: vscode.Disposable;

    constructor(private readonly store: ProjectStore) {
        this.storeSubscription = store.onDidChange(() => this.emitter.fire(undefined));
    }

    getTreeItem(node: TreeAteNode): vscode.TreeItem {
        const collapsible = node.kind === 'case' || node.kind === 'tp'
            ? vscode.TreeItemCollapsibleState.None
            : vscode.TreeItemCollapsibleState.Expanded;
        const item = new vscode.TreeItem(node.name, collapsible);
        item.id = node.id;
        item.contextValue = `treeate.${node.kind}`;
        item.description = node.description;
        item.tooltip = new vscode.MarkdownString(`**${node.name}**\n\n${node.description || t('tree.noDescription')}`);
        item.iconPath = new vscode.ThemeIcon(node.kind === 'project' ? 'root-folder' : node.kind === 'suite' ? 'beaker' : 'symbol-method');
        return item;
    }

    getChildren(node?: TreeAteNode): TreeAteNode[] { return this.store.getChildren(node); }
    getParent(node: TreeAteNode): TreeAteNode | undefined { return this.store.getParent(node); }

    handleDrag(source: readonly TreeAteNode[], transfer: vscode.DataTransfer): void {
        if (source[0]) { transfer.set(TREE_MIME, new vscode.DataTransferItem(source[0].id)); }
    }

    async handleDrop(target: TreeAteNode | undefined, transfer: vscode.DataTransfer): Promise<void> {
        const sourceId = transfer.get(TREE_MIME)?.value;
        if (!target || typeof sourceId !== 'string') { return; }
        const source = this.store.findNode(sourceId);
        if (!source) { return; }
        try { await this.store.reorder(source, target); }
        catch (error) { void vscode.window.showWarningMessage(String(error)); }
    }

    refresh(): void { this.emitter.fire(undefined); }
    dispose(): void { this.storeSubscription.dispose(); this.emitter.dispose(); }
}
