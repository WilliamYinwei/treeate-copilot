(() => {
    const vscode = acquireVsCodeApi();
    const host = document.getElementById('table');
    const empty = document.getElementById('empty');
    let model = { columns: [], rows: [] };

    window.addEventListener('message', event => {
        if (event.data.type !== 'render') {return;}
        model = event.data.data || { columns: [], rows: [] };
        render();
    });

    function render() {
        host.replaceChildren();
        if (!model.rows.length) {
            empty.style.display = 'block';
            empty.textContent = '当前节点下没有测试项。';
            return;
        }
        empty.style.display = 'none';
        const bar = document.createElement('div');
        bar.className = 'toolbar';
        const name = document.createElement('input');
        name.placeholder = '新增参数列（字母/数字/下划线）';
        const add = document.createElement('button');
        add.textContent = '新增列';
        add.onclick = () => {
            const value = name.value.trim();
            if (!/^[A-Za-z0-9_]+$/.test(value)) { name.classList.add('invalid'); return; }
            name.classList.remove('invalid');
            if (!model.columns.includes(value)) {model.columns.push(value);}
            for (const row of model.rows) {row.cells[value] = { value: '', inherited: false, source: 'case' };}
            render();
        };
        bar.append(name, add);
        host.append(bar);

        const wrap = document.createElement('div'); wrap.className = 'table-wrap';
        const table = document.createElement('table');
        const head = document.createElement('thead');
        const hr = document.createElement('tr');
        ['测试项', ...model.columns].forEach(label => { const th = document.createElement('th'); th.textContent = label; hr.append(th); });
        head.append(hr); table.append(head);
        const body = document.createElement('tbody');
        for (const row of model.rows) {
            const tr = document.createElement('tr');
            const label = document.createElement('td'); label.textContent = row.label; tr.append(label);
            for (const column of model.columns) {
                const td = document.createElement('td');
                const input = document.createElement('input');
                const cell = row.cells[column] || { value: '', inherited: false, source: 'none' };
                input.value = cell.value;
                if (cell.inherited) {input.classList.add('inherited');}
                input.title = cell.inherited ? `继承自${cell.source === 'suite' ? '测试套' : '工程'}；编辑后成为测试项参数` : '测试项自定义参数';
                input.onchange = () => {
                    input.classList.remove('inherited');
                    vscode.postMessage({ type: 'setCell', nodeId: row.nodeId, name: column, value: input.value });
                };
                td.append(input); tr.append(td);
            }
            body.append(tr);
        }
        table.append(body); wrap.append(table); host.append(wrap);
        const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = '斜体值为继承值；编辑后会写入测试项 Parameter，优先级：测试项 > 测试套 > 工程。'; host.append(hint);
    }
})();
