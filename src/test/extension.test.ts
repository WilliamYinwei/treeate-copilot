import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { suite, suiteSetup, test } from 'mocha';
import * as vscode from 'vscode';
import { parseInspectorOutput, peExportsName } from '../dllInspector';
import { setLanguageOverrideForTests } from '../i18n';
import { readParameterDescriptions, readParameters, writeParameterDescriptions, writeParameters } from '../model';
import { decodeCsvBuffer, parseParameterCsv, serializeParameterCsv } from '../parameterTableCsv';
import { ProjectStore } from '../projectStore';
import { TREEATE_APIS } from '../treeAteApiIntelliSense';

suite('TreeATE Copilot', () => {
    suiteSetup(() => setLanguageOverrideForTests('zh-cn'));

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
        for (const command of ['treeate.newProject', 'treeate.openProject', 'treeate.addChild', 'treeate.openProperties', 'treeate.runProject', 'treeate.importParameterCsv', 'treeate.exportParameterCsv']) {
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
            const table = store.getParameterTable(project);
            assert.ok(!table.columns.includes('publicOnly'));
            assert.deepStrictEqual(table.rows.map(row => row.label), ['demo', 'suite1', 'suite1 / case1']);
            assert.strictEqual(table.rows[0].cells.timeout.value, '10');
            assert.strictEqual(table.rows[0].cells.timeout.inherited, false);
            assert.strictEqual(table.rows[1].cells.timeout.value, '20');
            assert.strictEqual(table.rows[1].cells.timeout.inherited, false);
            assert.strictEqual(table.rows[2].cells.publicOnly, undefined);
            assert.strictEqual(table.rows[2].cells.timeout.value, '20');
            assert.strictEqual(table.rows[2].cells.timeout.inherited, true);

            const suiteTable = store.getParameterTable(testSuite);
            assert.deepStrictEqual(suiteTable.rows.map(row => row.label), ['suite1', 'suite1 / case1']);
            assert.strictEqual(suiteTable.rows[0].cells.timeout.inherited, false);

            await store.setCell(table.rows[0].nodeId, 'timeout', '11');
            await store.setCell(suiteTable.rows[0].nodeId, 'timeout', '21');
            await store.setCell(suiteTable.rows[1].nodeId, 'timeout', '30');
            const saved = JSON.parse(await fs.readFile(path.join(root, 'Demo.tp'), 'utf8'));
            assert.strictEqual(saved.Parameter.timeout, '11');
            assert.strictEqual(saved.TestSuite[0].Parameter.timeout, '21');
            assert.strictEqual(saved.TestSuite[0].TestCase[0].Parameter.timeout, '30');
            assert.deepStrictEqual(saved.VendorField, { keep: true });

            await store.deleteParameterColumn(store.getChildren(testSuite)[0], 'timeout');
            const afterInherited = JSON.parse(await fs.readFile(path.join(root, 'Demo.tp'), 'utf8'));
            assert.strictEqual(afterInherited.Parameter.timeout, undefined);
            assert.strictEqual(afterInherited.TestSuite[0].Parameter.timeout, undefined);
            assert.strictEqual(afterInherited.TestSuite[0].TestCase[0].Parameter.timeout, undefined);
            assert.strictEqual(afterInherited.TestSuite[0].TestCase[0].Parameter.retries, '2');

            await store.deleteParameterColumn(project, 'retries');
            const afterDelete = JSON.parse(await fs.readFile(path.join(root, 'Demo.tp'), 'utf8'));
            assert.strictEqual(afterDelete.TestSuite[0].TestCase[0].Parameter.retries, undefined);
        } finally {
            store.dispose();
            await fs.rm(root, { recursive: true, force: true });
        }
    });

    test('round-trips hierarchical parameter CSV with BOM and quoted fields', () => {
        const content = serializeParameterCsv(['timeout', 'retries'], [
            { depth: 1, name: 'demo', description: '工程,含逗号', parameters: { timeout: '10' } },
            { depth: 2, name: 'suite 1', description: '含"引号"', parameters: { timeout: '20' } },
            { depth: 3, name: 'case1', description: '第一行\n第二行', parameters: { retries: '2' } }
        ]);
        assert.ok(content.startsWith('\uFEFF'));
        const parsed = parseParameterCsv(content);
        assert.deepStrictEqual(parsed.columns, ['retries', 'timeout']);
        assert.deepStrictEqual(parsed.rows.map(row => [row.depth, row.name, row.description]), [
            [1, 'demo', '工程,含逗号'],
            [2, 'suite 1', '含"引号"'],
            [3, 'case1', '第一行\n第二行']
        ]);
        assert.deepStrictEqual(parsed.rows[0].parameters, { retries: '', timeout: '10' });
        assert.deepStrictEqual(parsed.rows[2].parameters, { retries: '2', timeout: '' });
    });

    test('rejects malformed hierarchical parameter CSV', () => {
        assert.throws(() => parseParameterCsv('Name,Description\n   case1,\n'), /第一行必须是测试工程/);
        assert.throws(() => parseParameterCsv('Name,Description,1bad\n demo,,\n'), /参数列/);
        assert.throws(() => parseParameterCsv('Name,Description,timeout\n demo,,\n   case1,,\n'), /层级不能跳跃/);
        assert.throws(() => parseParameterCsv('Name,Description\n demo,\n"unclosed\n'), /引号未闭合/);
    });

    test('decodes UTF-8 BOM and GBK encoded CSV files', () => {
        const utf8 = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Name,Description\r\n demo,中文\r\n', 'utf8')]);
        assert.strictEqual(parseParameterCsv(decodeCsvBuffer(utf8)).rows[0].description, '中文');
        const gbk = Buffer.concat([
            Buffer.from('Name,Description\r\n demo,', 'ascii'),
            Buffer.from([0xd6, 0xd0, 0xce, 0xc4]),
            Buffer.from('\r\n', 'ascii')
        ]);
        assert.strictEqual(parseParameterCsv(decodeCsvBuffer(gbk)).rows[0].description, '中文');
    });

    test('exports and imports hierarchical parameter CSV at project level', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'treeate-copilot-csv-'));
        const store = new ProjectStore();
        try {
            await fs.writeFile(path.join(root, 'Demo.tpx'), JSON.stringify({ Name: 'demo', Instance: [{ File: 'Demo.tp', Name: 'A', Parameter: [] }] }));
            await fs.writeFile(path.join(root, 'Demo.tp'), JSON.stringify({
                Name: 'demo', Desc: '工程', Ver: '2.4.0', VendorField: { keep: true }, Parameter: { timeout: '10' },
                Public: { Models: [], Parameter: { publicOnly: 'shared' } },
                TestSuite: [{
                    Name: 'suite1', Desc: '', Parameter: { timeout: '20', retries: '1' },
                    TestCase: [{ Name: 'case1', Desc: '', Parameter: { retries: '2' } }]
                }]
            }));
            await store.open(root);
            const project = store.rootNode!;
            const csv = store.exportParameterCsv(project);
            const parsed = parseParameterCsv(csv);
            assert.deepStrictEqual(parsed.columns, ['retries', 'timeout']);
            assert.deepStrictEqual(parsed.rows.map(row => row.depth), [1, 2, 3]);
            assert.deepStrictEqual(parsed.rows[0].parameters, { retries: '', timeout: '10' });
            assert.throws(() => store.exportParameterCsv(store.getChildren(project)[0]), /测试工程根节点/);

            const rows = parsed.rows.map(row => ({ ...row }));
            rows[1].description = '测试套';
            rows[1].parameters.retries = '';
            rows[2].parameters.retries = '5';
            const result = await store.importParameterCsv(project, serializeParameterCsv(parsed.columns, rows));
            assert.deepStrictEqual(result, { files: 1, nodes: 3 });

            const saved = JSON.parse(await fs.readFile(path.join(root, 'Demo.tp'), 'utf8'));
            assert.strictEqual(saved.TestSuite[0].Desc, '测试套');
            assert.strictEqual(saved.TestSuite[0].Parameter.retries, '');
            assert.strictEqual(saved.TestSuite[0].TestCase[0].Parameter.retries, '5');
            assert.strictEqual(saved.Parameter.timeout, '10');
            assert.strictEqual(saved.Parameter.retries, '');
            assert.strictEqual(saved.Public.Parameter.publicOnly, 'shared');
            assert.deepStrictEqual(saved.VendorField, { keep: true });

            const before = await fs.readFile(path.join(root, 'Demo.tp'), 'utf8');
            await assert.rejects(() => store.importParameterCsv(project, 'Name,Description,timeout\n demo,,\n  missing,,1\n'), /找不到测试套/);
            assert.strictEqual(await fs.readFile(path.join(root, 'Demo.tp'), 'utf8'), before);
        } finally {
            store.dispose();
            await fs.rm(root, { recursive: true, force: true });
        }
    });
});
