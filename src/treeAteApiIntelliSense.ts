import * as vscode from 'vscode';

interface ApiParameter {
    readonly name: string;
    readonly description: string;
}

interface ApiDefinition {
    readonly objectName: '__ate' | '__aterun';
    readonly name: string;
    readonly returnType: string;
    readonly description: string;
    readonly parameters: readonly ApiParameter[];
}

export const TREEATE_APIS: readonly ApiDefinition[] = [
    {
        objectName: '__ate',
        name: 'OutputRst', returnType: 'None',
        description: '将测试结果输出到界面，并存储到本地或远程服务器。远程存储需要自定义扩展。',
        parameters: [
            { name: 'strName', description: '测试结果名称。建议使用统一规范的不良代码，例如 F01003。' },
            { name: 'strValue', description: '测试结果值，字符串格式。' },
            { name: 'strStand', description: '测试结果标准的描述信息，字符串格式。' }
        ]
    },
    {
        objectName: '__ate',
        name: 'OutputRstEx', returnType: 'None',
        description: 'V1.1 及以上版本支持。功能与 OutputRst 相同，并可显式指定结果状态。',
        parameters: [
            { name: 'strName', description: '测试结果名称。建议使用统一规范的不良代码。' },
            { name: 'strValue', description: '测试结果值，字符串格式。' },
            { name: 'strStand', description: '测试结果标准的描述信息，字符串格式。' },
            { name: 'rst', description: '结果状态：0=Info，1=Pass，2=Fail，3=Exce（异常）。' }
        ]
    },
    {
        objectName: '__ate',
        name: 'OutputError', returnType: 'None',
        description: '输出错误信息。该接口由 TreeATE API 文档示例使用。',
        parameters: [{ name: 'message', description: '要输出的信息。' }]
    },
    {
        objectName: '__ate',
        name: 'GetUserName', returnType: 'str',
        description: '获取当前用户名。该接口及其返回类型由 TreeATE API 文档示例给出。',
        parameters: []
    },
    {
        objectName: '__ate',
        name: 'GetProjectName', returnType: 'str',
        description: '获取测试工程名称。该接口及其返回类型由 TreeATE API 文档示例给出。',
        parameters: []
    },
    {
        objectName: '__ate',
        name: 'GetProjectVer', returnType: 'str',
        description: '获取测试工程版本号。该接口及其返回类型由 TreeATE API 文档示例给出。',
        parameters: []
    },
    {
        objectName: '__ate',
        name: 'GetProjectDesc', returnType: 'str',
        description: '获取测试工程描述信息。该接口及其返回类型由 TreeATE API 文档示例给出。',
        parameters: []
    },
    {
        objectName: '__ate',
        name: 'GetWorkLine', returnType: 'str',
        description: '获取产线名称。该接口及其返回类型由 TreeATE API 文档示例给出。',
        parameters: []
    },
    {
        objectName: '__ate',
        name: 'GetWorkStation', returnType: 'str',
        description: '获取工站名称。该接口及其返回类型由 TreeATE API 文档示例给出。',
        parameters: []
    },
    {
        objectName: '__ate',
        name: 'GetTotalRst', returnType: 'Int',
        description: '获取当前总测试结果状态值（0：Info信息，1：Pass成功，2：Fail失败，3：Exce异常），在V1.1.3版本以上支持。',
        parameters: []
    },
    {
        objectName: '__aterun',
        name: 'IsStopped', returnType: 'bool',
        description: '判断当前测试执行是否已停止。该接口仅属于 __aterun。',
        parameters: []
    }
] as const;

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
                contents.appendMarkdown(api.description);
                for (const parameter of api.parameters) {
                    contents.appendMarkdown(`\n\n- \`${parameter.name}\`：${parameter.description}`);
                }
                return new vscode.Hover(contents, range);
            }
        })
    );
}

function completionItem(api: ApiDefinition, index: number): vscode.CompletionItem {
    const item = new vscode.CompletionItem(api.name, vscode.CompletionItemKind.Method);
    item.detail = formatSignature(api);
    item.documentation = new vscode.MarkdownString(api.description);
    item.sortText = String(index).padStart(2, '0');
    const argumentsSnippet = api.parameters
        .map((parameter, parameterIndex) => '${' + (parameterIndex + 1) + ':' + parameter.name + '}')
        .join(', ');
    item.insertText = new vscode.SnippetString(`${api.name}(${argumentsSnippet})`);
    item.command = { title: '显示参数提示', command: 'editor.action.triggerParameterHints' };
    return item;
}

function signatureInformation(api: ApiDefinition): vscode.SignatureInformation {
    const signature = new vscode.SignatureInformation(formatSignature(api), new vscode.MarkdownString(api.description));
    signature.parameters = api.parameters.map(parameter => new vscode.ParameterInformation(parameter.name, parameter.description));
    return signature;
}

function formatSignature(api: ApiDefinition): string {
    return `${api.objectName}.${api.name}(${api.parameters.map(parameter => parameter.name).join(', ')}) -> ${api.returnType}`;
}

function commaCount(value: string): number {
    return [...value].filter(character => character === ',').length;
}
