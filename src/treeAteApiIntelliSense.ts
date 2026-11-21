import * as vscode from 'vscode';
import { MessageKey, t } from './i18n';

interface ApiParameter {
    readonly name: string;
    readonly descriptionKey: MessageKey;
}

interface ApiDefinition {
    readonly objectName: '__ate' | '__aterun';
    readonly name: string;
    readonly returnType: string;
    readonly descriptionKey: MessageKey;
    readonly parameters: readonly ApiParameter[];
}

export const TREEATE_APIS: readonly ApiDefinition[] = [
    {
        objectName: '__ate',
        name: 'OutputRst', returnType: 'None',
        descriptionKey: 'intellisense.OutputRst.desc',
        parameters: [
            { name: 'strName', descriptionKey: 'intellisense.OutputRst.strName' },
            { name: 'strValue', descriptionKey: 'intellisense.OutputRst.strValue' },
            { name: 'strStand', descriptionKey: 'intellisense.OutputRst.strStand' }
        ]
    },
    {
        objectName: '__ate',
        name: 'OutputRstEx', returnType: 'None',
        descriptionKey: 'intellisense.OutputRstEx.desc',
        parameters: [
            { name: 'strName', descriptionKey: 'intellisense.OutputRstEx.strName' },
            { name: 'strValue', descriptionKey: 'intellisense.OutputRstEx.strValue' },
            { name: 'strStand', descriptionKey: 'intellisense.OutputRstEx.strStand' },
            { name: 'rst', descriptionKey: 'intellisense.OutputRstEx.rst' }
        ]
    },
    {
        objectName: '__ate',
        name: 'OutputError', returnType: 'None',
        descriptionKey: 'intellisense.OutputError.desc',
        parameters: [{ name: 'message', descriptionKey: 'intellisense.OutputError.message' }]
    },
    {
        objectName: '__ate',
        name: 'GetUserName', returnType: 'str',
        descriptionKey: 'intellisense.GetUserName.desc',
        parameters: []
    },
    {
        objectName: '__ate',
        name: 'GetProjectName', returnType: 'str',
        descriptionKey: 'intellisense.GetProjectName.desc',
        parameters: []
    },
    {
        objectName: '__ate',
        name: 'GetProjectVer', returnType: 'str',
        descriptionKey: 'intellisense.GetProjectVer.desc',
        parameters: []
    },
    {
        objectName: '__ate',
        name: 'GetProjectDesc', returnType: 'str',
        descriptionKey: 'intellisense.GetProjectDesc.desc',
        parameters: []
    },
    {
        objectName: '__ate',
        name: 'GetWorkLine', returnType: 'str',
        descriptionKey: 'intellisense.GetWorkLine.desc',
        parameters: []
    },
    {
        objectName: '__ate',
        name: 'GetWorkStation', returnType: 'str',
        descriptionKey: 'intellisense.GetWorkStation.desc',
        parameters: []
    },
    {
        objectName: '__ate',
        name: 'GetTotalRst', returnType: 'Int',
        descriptionKey: 'intellisense.GetTotalRst.desc',
        parameters: []
    },
    {
        objectName: '__aterun',
        name: 'IsStopped', returnType: 'bool',
        descriptionKey: 'intellisense.IsStopped.desc',
        parameters: []
    }
];

const apiByQualifiedName = new Map(TREEATE_APIS.map(api => [`${api.objectName}.${api.name}`, api]));

export function registerTreeAteApiIntelliSense(): vscode.Disposable {
    const selector: vscode.DocumentSelector = { language: 'python' };
    return vscode.Disposable.from(
        vscode.languages.registerCompletionItemProvider(selector, {
            provideCompletionItems(document, position) {
                const prefix = document.lineAt(position).text.slice(0, position.character);
                const match = /\b(__ate|__aterun)\.[A-Za-z_]*$/.exec(prefix);
                if (!match) { return undefined; }
                return TREEATE_APIS
                    .filter(api => api.objectName === match[1])
                    .map((api, index) => completionItem(api, index));
            }
        }, '.'),
        vscode.languages.registerSignatureHelpProvider(selector, {
            provideSignatureHelp(document, position) {
                const prefix = document.lineAt(position).text.slice(0, position.character);
                const match = /\b(__ate|__aterun)\.([A-Za-z_][A-Za-z0-9_]*)\((.*)$/.exec(prefix);
                const api = match ? apiByQualifiedName.get(`${match[1]}.${match[2]}`) : undefined;
                if (!api) { return undefined; }
                const help = new vscode.SignatureHelp();
                help.signatures = [signatureInformation(api)];
                help.activeSignature = 0;
                help.activeParameter = Math.min(commaCount(match![3]), Math.max(0, api.parameters.length - 1));
                return help;
            }
        }, '(', ','),
        vscode.languages.registerHoverProvider(selector, {
            provideHover(document, position) {
                const range = document.getWordRangeAtPosition(position, /__(?:ate|aterun)\.[A-Za-z_][A-Za-z0-9_]*/);
                if (!range) { return undefined; }
                const api = apiByQualifiedName.get(document.getText(range));
                if (!api) { return undefined; }
                const contents = new vscode.MarkdownString();
                contents.appendCodeblock(formatSignature(api), 'python');
                contents.appendMarkdown(t(api.descriptionKey));
                for (const parameter of api.parameters) {
                    contents.appendMarkdown(`\n\n${t('intellisense.parameterDoc', parameter.name, t(parameter.descriptionKey))}`);
                }
                return new vscode.Hover(contents, range);
            }
        })
    );
}

function completionItem(api: ApiDefinition, index: number): vscode.CompletionItem {
    const item = new vscode.CompletionItem(api.name, vscode.CompletionItemKind.Method);
    item.detail = formatSignature(api);
    item.documentation = new vscode.MarkdownString(t(api.descriptionKey));
    item.sortText = String(index).padStart(2, '0');
    const argumentsSnippet = api.parameters
        .map((parameter, parameterIndex) => '${' + (parameterIndex + 1) + ':' + parameter.name + '}')
        .join(', ');
    item.insertText = new vscode.SnippetString(`${api.name}(${argumentsSnippet})`);
    item.command = { title: t('intellisense.showParameterHints'), command: 'editor.action.triggerParameterHints' };
    return item;
}

function signatureInformation(api: ApiDefinition): vscode.SignatureInformation {
    const signature = new vscode.SignatureInformation(formatSignature(api), new vscode.MarkdownString(t(api.descriptionKey)));
    signature.parameters = api.parameters.map(parameter => new vscode.ParameterInformation(parameter.name, t(parameter.descriptionKey)));
    return signature;
}

function formatSignature(api: ApiDefinition): string {
    return `${api.objectName}.${api.name}(${api.parameters.map(parameter => parameter.name).join(', ')}) -> ${api.returnType}`;
}

function commaCount(value: string): number {
    return [...value].filter(character => character === ',').length;
}
