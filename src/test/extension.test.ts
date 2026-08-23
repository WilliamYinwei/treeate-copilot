import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { suite, test } from 'mocha';
import * as vscode from 'vscode';
import { readParameterDescriptions, readParameters, writeParameterDescriptions, writeParameters } from '../model';
import { ProjectStore } from '../projectStore';

suite('TreeATE Copilot', () => {
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

    test('loads the three-level tree and writes only the case override', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'treeate-copilot-test-'));
        const store = new ProjectStore();
        try {
            await fs.writeFile(path.join(root, 'Demo.tpx'), JSON.stringify({ Name: 'demo', Instance: [{ File: 'Demo.tp', Name: 'A', Parameter: [] }] }));
            await fs.writeFile(path.join(root, 'Demo.tp'), JSON.stringify({
                Name: 'demo', Ver: '2.4.0', VendorField: { keep: true }, Parameter: { timeout: '10' },
                Public: { Models: [], Parameter: [] },
                TestSuite: [{ Name: 'suite1', Desc: '', Parameter: { timeout: '20' }, TestCase: [{ Name: 'case1', Desc: '', Parameter: { retries: '2' } }] }]
            }));
            await store.open(root);
            const project = store.rootNode!;
            const testSuite = store.getChildren(project)[0];
            const testCase = store.getChildren(testSuite)[0];
            const table = store.getParameterTable(project);
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
