import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import { parseInspectorOutput, peExportsName } from '../dllInspector';
import { readParameterDescriptions, readParameters, writeParameterDescriptions, writeParameters } from '../model';
import { ProjectStore } from '../projectStore';
import { TREEATE_APIS } from '../treeAteApiIntelliSense';

suite('TreeATE Copilot', () => {
    test('parses QObject method and parameter metadata returned by the Qt inspector', () => {
        const result = parseInspectorOutput('plugin output\nTREEATE_QT_META:{"status":"ok","className":"DemoDevice","methods":[{"name":"readValue","signature":"readValue(QString,int)","returnType":"int","parameters":[{"name":"channel","type":"QString"},{"name":"timeout","type":"int"}]}]}\n');
        assert.deepStrictEqual(result, {
            status: 'ok', className: 'DemoDevice', methods: [{
                name: 'readValue', signature: 'readValue(QString,int)', returnType: 'int',
                parameters: [{ name: 'channel', type: 'QString' }, { name: 'timeout', type: 'int' }]
            }]
        });
    });

    test('recognizes a DLL without CreateDeviceInst as unsupported', () => {
        assert.deepStrictEqual(
            parseInspectorOutput('TREEATE_QT_META:{"status":"unsupported","reason":"missing export"}\n'),
            { status: 'unsupported', reason: 'missing export' }
        );
    });

    test('finds CreateDeviceInst in a PE export table', () => {
        const image = Buffer.alloc(1024);
        image.write('MZ', 0, 'ascii');
        image.writeUInt32LE(0x80, 0x3c);
        image.write('PE\0\0', 0x80, 'ascii');
        image.writeUInt16LE(1, 0x86);
        image.writeUInt16LE(0xf0, 0x94);
        image.writeUInt16LE(0x20b, 0x98);
        image.writeUInt32LE(0x1000, 0x108);
        const section = 0x188;
        image.writeUInt32LE(0x200, section + 8);
        image.writeUInt32LE(0x1000, section + 12);
        image.writeUInt32LE(0x200, section + 16);
        image.writeUInt32LE(0x200, section + 20);
        image.writeUInt32LE(1, 0x218);
        image.writeUInt32LE(0x1040, 0x220);
        image.writeUInt32LE(0x1050, 0x240);
        image.write('CreateDeviceInst\0', 0x250, 'ascii');
        assert.strictEqual(peExportsName(image, 'CreateDeviceInst'), true);
        assert.strictEqual(peExportsName(image, 'AnotherFunction'), false);
    });

    test('reads both V2.4 parameter representations', () => {
        assert.deepStrictEqual(readParameters({ timeout: '30' }), { timeout: '30' });
        assert.deepStrictEqual(readParameters([{ Name: 'timeout', Value: '30', Desc: 'seconds' }]), { timeout: '30' });
    });

    test('preserves array parameter metadata while updating', () => {
        const owner: Record<string, unknown> = { Parameter: [{ Name: 'timeout', Value: '30', Desc: 'seconds', Vendor: 1 }] };
        writeParameters(owner, { timeout: '60', retry: '2' });
        assert.deepStrictEqual(owner.Parameter, [
            { Name: 'timeout', Value: '60', Desc: 'seconds', Vendor: 1 },
            { Name: 'retry', Value: '2', Desc: '' }
        ]);
    });

    test('reads and updates public parameter descriptions without dropping metadata', () => {
        const owner: Record<string, unknown> = { Parameter: [{ Name: 'timeout', Value: '30', Desc: 'seconds', Vendor: 1 }] };
        assert.deepStrictEqual(readParameterDescriptions(owner.Parameter), { timeout: 'seconds' });
        writeParameterDescriptions(owner, { timeout: '超时时间' });
        assert.deepStrictEqual(owner.Parameter, [{ Name: 'timeout', Value: '30', Desc: '超时时间', Vendor: 1 }]);
    });

    test('registers the public command surface', async () => {
        const commands = await vscode.commands.getCommands(true);
        for (const command of ['treeate.newProject', 'treeate.openProject', 'treeate.addChild', 'treeate.openProperties', 'treeate.runProject']) {
            assert.ok(commands.includes(command), `${command} should be registered`);
        }
    });

    test('provides IntelliSense for the injected TreeATE API object', async () => {
        const document = await vscode.workspace.openTextDocument({ language: 'python', content: '__ate.\n__ate.OutputRst(\n__aterun.\n__aterun.IsStopped(' });
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider', document.uri, document.lineAt(0).range.end, '.'
        );
        const labels = completions.items.map(item => typeof item.label === 'string' ? item.label : item.label.label);
        const ateNames = TREEATE_APIS.filter(api => api.objectName === '__ate').map(api => api.name);
        assert.deepStrictEqual(ateNames.filter(name => !labels.includes(name)), []);
        assert.ok(!labels.includes('IsStopped'));

        const signatures = await vscode.commands.executeCommand<vscode.SignatureHelp>(
            'vscode.executeSignatureHelpProvider', document.uri, document.lineAt(1).range.end, '('
        );
        assert.ok(signatures.signatures[0].label.startsWith('__ate.OutputRst(strName, strValue, strStand)'));
        assert.strictEqual(signatures.signatures[0].parameters.length, 3);

        const runCompletions = await vscode.commands.executeCommand<vscode.CompletionList>(
            'vscode.executeCompletionItemProvider', document.uri, document.lineAt(2).range.end, '.'
        );
        const runLabels = runCompletions.items.map(item => typeof item.label === 'string' ? item.label : item.label.label);
        assert.ok(runLabels.includes('IsStopped'));
        assert.ok(!runLabels.includes('OutputRst'));

        const runSignatures = await vscode.commands.executeCommand<vscode.SignatureHelp>(
            'vscode.executeSignatureHelpProvider', document.uri, document.lineAt(3).range.end, '('
        );
        assert.ok(runSignatures.signatures[0].label.startsWith('__aterun.IsStopped()'));
    });

    test('loads the three-level tree and writes only the case override', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'treeate-copilot-test-'));
        const store = new ProjectStore();
        try {
            await fs.writeFile(path.join(root, 'Demo.tpx'), JSON.stringify({ Name: 'demo', Instance: [{ File: 'Demo.tp', Name: 'A', Parameter: [] }] }));
            await fs.writeFile(path.join(root, 'Demo.tp'), JSON.stringify({
                Name: 'demo', Ver: '2.4.0', VendorField: { keep: true }, Parameter: { timeout: '10' },
                Public: { Models: [], Parameter: { publicOnly: 'shared' } },
                TestSuite: [{ Name: 'suite1', Desc: '', Parameter: { timeout: '20' }, TestCase: [{ Name: 'case1', Desc: '', Parameter: { retries: '2' } }] }]
            }));
            await store.open(root);
            const project = store.rootNode!;
            const testSuite = store.getChildren(project)[0];
            const testCase = store.getChildren(testSuite)[0];
            const table = store.getParameterTable(project);
            assert.ok(!table.columns.includes('publicOnly'));
            assert.strictEqual(table.rows[0].cells.publicOnly, undefined);
            assert.strictEqual(table.rows[0].cells.timeout.value, '20');
            assert.strictEqual(table.rows[0].cells.timeout.source, 'suite');
            await store.setCell(testCase.id, 'timeout', '30');
            const saved = JSON.parse(await fs.readFile(path.join(root, 'Demo.tp'), 'utf8'));
            assert.strictEqual(saved.TestSuite[0].TestCase[0].Parameter.timeout, '30');
            assert.deepStrictEqual(saved.VendorField, { keep: true });
        } finally {
            store.dispose();
            await fs.rm(root, { recursive: true, force: true });
        }
    });
});
