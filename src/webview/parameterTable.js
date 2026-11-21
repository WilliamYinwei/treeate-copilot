(() => {
    const vscode = acquireVsCodeApi();
    const strings = (window.__treeateI18n && window.__treeateI18n.parameterTable) || {};
    const format = (template, ...args) => String(template || '').replace(/\{(\d+)\}/g, (match, index) => args[Number(index)] === undefined ? match : String(args[Number(index)]));
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
            empty.textContent = strings.noParameters;
            return;
        }
        empty.style.display = 'none';
        const bar = document.createElement('div');
        bar.className = 'toolbar';
        const name = document.createElement('input');
        name.placeholder = strings.newColumnPlaceholder;
        const add = document.createElement('button');
        add.textContent = strings.addColumn;
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
        const nodeHead = document.createElement('th');
        nodeHead.textContent = strings.nodeHeader;
        hr.append(nodeHead);
        for (const column of model.columns) {
            const th = document.createElement('th');
            const columnHead = document.createElement('span');
            columnHead.className = 'column-head';
            const label = document.createElement('span');
            label.textContent = column;
            const remove = document.createElement('button');
            remove.className = 'remove-column';
            remove.textContent = '×';
            remove.title = format(strings.deleteColumnTitle, column);
            remove.onclick = () => vscode.postMessage({ type: 'deleteColumn', name: column });
            columnHead.append(label, remove);
            th.append(columnHead);
            hr.append(th);
        }
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
                input.title = cell.inherited ? (cell.source === 'suite' ? strings.inheritedFromSuite : strings.inheritedFromProject) : strings.customParameter;
                input.onchange = () => {
                    input.classList.remove('inherited');
                    vscode.postMessage({ type: 'setCell', nodeId: row.nodeId, name: column, value: input.value });
                };
                td.append(input); tr.append(td);
            }
            body.append(tr);
        }
        table.append(body); wrap.append(table); host.append(wrap);
        const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = strings.hint; host.append(hint);
    }
})();
