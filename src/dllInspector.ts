import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

const OUTPUT_MARKER = 'TREEATE_QT_META:';

export interface DllMethodParameter {
    name: string;
    type: string;
}

export interface DllMethod {
    name: string;
    signature: string;
    returnType: string;
    parameters: DllMethodParameter[];
}

export type DllInspection =
    | { status: 'ok'; className: string; methods: DllMethod[] }
    | { status: 'unsupported'; reason?: string }
    | { status: 'error'; message: string };

export class DllInspector {
    constructor(private readonly context: vscode.ExtensionContext) {}

    async inspect(dllPath: string): Promise<DllInspection> {
        try {
            if (!peExportsName(await fs.readFile(dllPath), 'CreateDeviceInst')) {
                return { status: 'unsupported', reason: 'CreateDeviceInst export was not found' };
            }
        } catch (error) {
            return { status: 'error', message: `无法读取 DLL：${error instanceof Error ? error.message : String(error)}` };
        }
        const executable = await this.findExecutable();
        if (!executable) {
            return {
                status: 'error',
                message: '未找到 Qt DLL 探测器。请构建 native/treeate-qt-inspector，或配置 treeate.qtInspectorPath。'
            };
        }
        try {
            return parseInspectorOutput(await runInspector(executable, dllPath));
        } catch (error) {
            return { status: 'error', message: error instanceof Error ? error.message : String(error) };
        }
    }

    private async findExecutable(): Promise<string | undefined> {
        const configured = vscode.workspace.getConfiguration('treeate').get<string>('qtInspectorPath', '').trim();
        const candidates = configured
            ? [path.isAbsolute(configured) ? configured : path.resolve(configured)]
            : [
                path.join(this.context.extensionPath, 'native', 'bin', 'treeate-qt-inspector.exe'),
                path.join(this.context.extensionPath, 'bin', 'treeate-qt-inspector.exe')
            ];
        for (const candidate of candidates) {
            try {
                if ((await fs.stat(candidate)).isFile()) { return candidate; }
            } catch { /* try the next candidate */ }
        }
        return undefined;
    }
}

export function parseInspectorOutput(output: string): DllInspection {
    const marker = output.lastIndexOf(OUTPUT_MARKER);
    if (marker < 0) { throw new Error('Qt DLL 探测器没有返回有效结果。'); }
    const text = output.slice(marker + OUTPUT_MARKER.length).trim().split(/\r?\n/, 1)[0];
    let value: unknown;
    try { value = JSON.parse(text); }
    catch { throw new Error('Qt DLL 探测器返回了无效的 JSON。'); }
    if (!isRecord(value) || typeof value.status !== 'string') { throw new Error('Qt DLL 探测器返回的数据格式不正确。'); }
    if (value.status === 'unsupported') {
        return { status: 'unsupported', reason: typeof value.reason === 'string' ? value.reason : undefined };
    }
    if (value.status === 'error') {
        return { status: 'error', message: typeof value.message === 'string' ? value.message : 'DLL 探测失败。' };
    }
    if (value.status !== 'ok' || typeof value.className !== 'string' || !Array.isArray(value.methods)) {
        throw new Error('Qt DLL 探测器返回的数据格式不正确。');
    }
    const methods: DllMethod[] = value.methods.filter(isRecord).map(method => ({
        name: typeof method.name === 'string' ? method.name : '',
        signature: typeof method.signature === 'string' ? method.signature : '',
        returnType: typeof method.returnType === 'string' ? method.returnType : '',
        parameters: Array.isArray(method.parameters) ? method.parameters.filter(isRecord).map(parameter => ({
            name: typeof parameter.name === 'string' ? parameter.name : '',
            type: typeof parameter.type === 'string' ? parameter.type : ''
        })) : []
    })).filter(method => method.name.length > 0);
    return { status: 'ok', className: value.className, methods };
}

export function peExportsName(image: Buffer, targetName: string): boolean {
    try {
        if (image.length < 64 || image.toString('ascii', 0, 2) !== 'MZ') { return false; }
        const peOffset = image.readUInt32LE(0x3c);
        if (peOffset + 24 > image.length || image.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') { return false; }
        const sectionCount = image.readUInt16LE(peOffset + 6);
        const optionalSize = image.readUInt16LE(peOffset + 20);
        const optionalOffset = peOffset + 24;
        const magic = image.readUInt16LE(optionalOffset);
        const dataDirectoryOffset = optionalOffset + (magic === 0x20b ? 112 : magic === 0x10b ? 96 : -1);
        if (dataDirectoryOffset < optionalOffset || dataDirectoryOffset + 8 > optionalOffset + optionalSize) { return false; }
        const exportRva = image.readUInt32LE(dataDirectoryOffset);
        if (!exportRva) { return false; }
        const sectionTable = optionalOffset + optionalSize;
        const rvaToOffset = (rva: number): number | undefined => {
            for (let index = 0; index < sectionCount; ++index) {
                const section = sectionTable + index * 40;
                if (section + 40 > image.length) { return undefined; }
                const virtualSize = image.readUInt32LE(section + 8);
                const virtualAddress = image.readUInt32LE(section + 12);
                const rawSize = image.readUInt32LE(section + 16);
                const rawOffset = image.readUInt32LE(section + 20);
                if (rva >= virtualAddress && rva < virtualAddress + Math.max(virtualSize, rawSize)) {
                    const result = rawOffset + rva - virtualAddress;
                    return result < image.length ? result : undefined;
                }
            }
            return rva < image.length ? rva : undefined;
        };
        const exportOffset = rvaToOffset(exportRva);
        if (exportOffset === undefined || exportOffset + 40 > image.length) { return false; }
        const nameCount = image.readUInt32LE(exportOffset + 24);
        const namesOffset = rvaToOffset(image.readUInt32LE(exportOffset + 32));
        if (namesOffset === undefined || namesOffset + nameCount * 4 > image.length) { return false; }
        for (let index = 0; index < nameCount; ++index) {
            const nameOffset = rvaToOffset(image.readUInt32LE(namesOffset + index * 4));
            if (nameOffset === undefined) { continue; }
            const end = image.indexOf(0, nameOffset);
            if (end >= 0 && image.toString('ascii', nameOffset, end) === targetName) { return true; }
        }
        return false;
    } catch { return false; }
}

function runInspector(executable: string, dllPath: string): Promise<string> {
    const environment = { ...process.env };
    const pathKey = Object.keys(environment).find(key => key.toLowerCase() === 'path') ?? 'Path';
    const libraryDirectory = path.dirname(dllPath);
    const searchDirectories = [libraryDirectory, path.dirname(libraryDirectory), path.dirname(executable)];
    const enginePath = vscode.workspace.getConfiguration('treeate').get<string>('testEnginePath', '').trim();
    if (enginePath) { searchDirectories.push(path.dirname(enginePath)); }
    environment[pathKey] = `${searchDirectories.join(path.delimiter)}${path.delimiter}${environment[pathKey] ?? ''}`;

    return new Promise((resolve, reject) => {
        execFile(executable, [dllPath], {
            cwd: path.dirname(dllPath), encoding: 'utf8', env: environment,
            windowsHide: true, timeout: 15_000, maxBuffer: 4 * 1024 * 1024
        }, (error, stdout, stderr) => {
            if (error) {
                const detail = String(stderr || stdout || error.message).trim();
                reject(new Error(`Qt DLL 探测器运行失败：${detail}`));
                return;
            }
            resolve(stdout);
        });
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
