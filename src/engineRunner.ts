import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import * as vscode from 'vscode';
import { ProjectStore } from './projectStore';

export class EngineRunner implements vscode.Disposable {
    private child?: ReturnType<typeof spawn>;
    readonly output = vscode.window.createOutputChannel('TreeATE Copilot');

    constructor(private readonly store: ProjectStore) {}

    async run(): Promise<void> {
        const project = this.store.current;
        if (!project) { throw new Error('请先打开 TreeATE 工程。'); }
        if (this.child && this.child.exitCode === null) { throw new Error('TestEngine 正在运行。'); }
        const config = vscode.workspace.getConfiguration('treeate');
        let executable = config.get<string>('testEnginePath', '').trim();
        if (!executable) {
            const local = path.join(project.rootDir, 'TestEngine.exe');
            try { await fs.access(local); executable = local; } catch { executable = 'TestEngine.exe'; }
        }
        const replacements: Record<string, string> = {
            '${tpx}': project.tpx.path, '${projectDir}': project.rootDir,
            '${projectName}': path.parse(project.tpx.path).name
        };
        const args = config.get<string[]>('testEngineArguments', ['${tpx}']).map(arg => Object.entries(replacements).reduce((result, [key, value]) => result.split(key).join(value), arg));
        this.output.show(true);
        this.output.appendLine(`[${new Date().toLocaleString()}] ${executable} ${args.map(item => `"${item}"`).join(' ')}`);
        this.child = spawn(executable, args, { cwd: project.rootDir, windowsHide: true, shell: false });
        this.child.stdout?.on('data', data => this.output.append(data.toString()));
        this.child.stderr?.on('data', data => this.output.append(data.toString()));
        this.child.on('error', error => this.output.appendLine(`\n启动失败：${error.message}`));
        this.child.on('close', code => this.output.appendLine(`\nTestEngine 已退出，代码 ${code ?? 'unknown'}。`));
    }

    dispose(): void { this.child?.kill(); this.output.dispose(); }
}
