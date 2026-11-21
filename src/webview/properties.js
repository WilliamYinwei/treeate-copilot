(() => {
    const vscode = acquireVsCodeApi();
    const strings = (window.__treeateI18n && window.__treeateI18n.properties) || {};
    const app = document.getElementById('app');
    const title = document.getElementById('title');
    const pathLabel = document.getElementById('path');
    const status = document.getElementById('status');
    const save = document.getElementById('save');
    let state;
    let valid = true;

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'render') { state = message.data; render(); }
        if (message.type === 'saved') { status.textContent = strings.saved; status.className = ''; }
        if (message.type === 'error') { status.textContent = message.message; status.className = 'error'; }
    });
    save.onclick = () => {
        validate();
        if (!valid) { status.textContent = strings.invalid; status.className = 'error'; return; }
        status.textContent = strings.saving; status.className = '';
        vscode.postMessage({ type: 'save', data: state });
    };

    function render() {
        if (!state) {return;}
        app.replaceChildren(); valid = true;
        title.textContent = `${kindLabel(state.kind)} · ${state.title}`;
        pathLabel.textContent = state.path || '';
        renderFields(state.fields || {});
        if (state.kind === 'tpx') {
            renderRecords(strings.guiPlugins, state.plugins, ['Com', 'Name']);
            renderRecords(strings.parallelTasks, state.instances, ['Name', 'File'], ['Parameter']);
        }
        if (state.kind === 'tp') {
            renderParameters(strings.globalParameters, state.globals, value => state.globals = value);
            renderRecords(strings.bindings, state.bindings, ['Com'], ['Name']);
            renderParameters(strings.publicParameters, state.publicParameters, value => state.publicParameters = value,
                state.publicParameterDescriptions, value => state.publicParameterDescriptions = value);
        }
        if (state.kind === 'suite') {
            renderRecords(strings.bindings, state.bindings, ['Com'], ['Name']);
            renderParameters(strings.suiteParameters, state.parameters, value => state.parameters = value);
            renderParameters(strings.publicParameters, state.publicParameters, value => state.publicParameters = value,
                state.publicParameterDescriptions, value => state.publicParameterDescriptions = value);
        }
        if (state.kind === 'case') {renderParameters(strings.caseParameters, state.parameters, value => state.parameters = value);}
        status.textContent = ''; status.className = '';
    }

    function renderFields(fields) {
        const section = sectionNode(strings.basicConfig);
        for (const [key, original] of Object.entries(fields)) {
            const row = document.createElement('label'); row.className = 'field';
            const label = document.createElement('span'); label.textContent = key;
            let input;
            if (typeof original === 'boolean') {
                input = document.createElement('input'); input.type = 'checkbox'; input.checked = original;
                input.onchange = () => fields[key] = input.checked;
            } else {
                input = document.createElement('input'); input.value = original === null || original === undefined ? '' : String(original);
                input.oninput = () => fields[key] = typeof original === 'number' ? Number(input.value) : input.value;
            }
            row.append(label, input); section.append(row);
        }
        app.append(section);
    }

    function renderParameters(heading, parameters, assign, descriptions, assignDescriptions) {
        parameters = parameters || {}; assign(parameters);
        const showDescriptions = descriptions !== undefined;
        descriptions = descriptions || {};
        if (assignDescriptions) {assignDescriptions(descriptions);}
        const section = sectionNode(heading);
        if (showDescriptions) {
            const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = strings.parameterHint; section.append(hint);
        }
        const list = document.createElement('div'); section.append(list);
        const draw = () => {
            list.replaceChildren();
            Object.entries(parameters).forEach(([name, value]) => {
                const row = document.createElement('div'); row.className = 'field';
                const nameInput = document.createElement('input'); nameInput.value = name; nameInput.placeholder = strings.parameterName; nameInput.dataset.paramName = '1';
                const valueWrap = document.createElement('div'); valueWrap.className = 'toolbar';
                const valueInput = document.createElement('input'); valueInput.value = String(value ?? ''); valueInput.placeholder = strings.parameterValue;
                const descriptionInput = document.createElement('input'); descriptionInput.value = String(descriptions[name] ?? ''); descriptionInput.placeholder = strings.description;
                const remove = document.createElement('button'); remove.className = 'icon'; remove.textContent = '×'; remove.title = strings.deleteParameter;
                nameInput.oninput = () => validateName(nameInput);
                nameInput.onchange = () => {
                    const next = nameInput.value.trim(); if (!validateName(nameInput) || next === name) {return;}
                    delete parameters[name]; parameters[next] = valueInput.value;
                    if (showDescriptions) { delete descriptions[name]; descriptions[next] = descriptionInput.value; }
                    name = next;
                };
                valueInput.oninput = () => parameters[name] = valueInput.value;
                descriptionInput.oninput = () => descriptions[name] = descriptionInput.value;
                remove.onclick = () => { delete parameters[name]; delete descriptions[name]; draw(); };
                valueWrap.append(valueInput);
                if (showDescriptions) {valueWrap.append(descriptionInput);}
                valueWrap.append(remove); row.append(nameInput, valueWrap); list.append(row);
            });
        };
        draw();
        const add = document.createElement('button'); add.textContent = strings.addParameter;
        add.onclick = () => {
            let index = 1; while (`param_${index}` in parameters) {index++;}
            const name = `param_${index}`; parameters[name] = '';
            if (showDescriptions) {descriptions[name] = '';}
            draw();
        };
        section.append(add); app.append(section);
    }

    function renderRecords(heading, records, preferred, hidden = []) {
        records = records || [];
        const section = sectionNode(heading);
        const wrap = document.createElement('div'); wrap.className = 'table-wrap'; section.append(wrap);
        const draw = () => {
            wrap.replaceChildren();
            const columns = [...new Set([...preferred, ...records.flatMap(record => Object.keys(record))])].filter(column => !hidden.includes(column));
            const table = document.createElement('table'); const head = document.createElement('thead'); const hr = document.createElement('tr');
            [...columns, ''].forEach(column => { const th = document.createElement('th'); th.textContent = column; hr.append(th); }); head.append(hr); table.append(head);
            const body = document.createElement('tbody');
            records.forEach((record, index) => {
                const tr = document.createElement('tr');
                columns.forEach(column => {
                    const td = document.createElement('td'); const input = document.createElement('input');
                    const original = record[column]; const objectValue = original && typeof original === 'object';
                    input.value = objectValue ? JSON.stringify(original) : String(original ?? '');
                    if (column === 'Parameter') {input.dataset.parameterJson = '1';}
                    input.oninput = () => {
                        if (objectValue || column === 'Parameter') {
                            try { record[column] = input.value.trim() ? JSON.parse(input.value) : {}; input.classList.remove('invalid'); }
                            catch { input.classList.add('invalid'); }
                        } else {record[column] = input.value;}
                    };
                    td.append(input); tr.append(td);
                });
                const td = document.createElement('td'); const remove = document.createElement('button'); remove.className = 'icon'; remove.textContent = '×';
                remove.onclick = () => { records.splice(index, 1); draw(); }; td.append(remove); tr.append(td); body.append(tr);
            });
            table.append(body); wrap.append(table);
        };
        draw(); const add = document.createElement('button'); add.textContent = strings.addRow; add.onclick = () => { records.push(Object.fromEntries(preferred.map(key => [key, key === 'Parameter' ? {} : '']))); draw(); };
        section.append(add); app.append(section);
    }

    function sectionNode(heading) {
        const section = document.createElement('section'); section.className = 'section';
        const h = document.createElement('h3'); h.textContent = heading; section.append(h); return section;
    }
    function kindLabel(kind) { return ({ tpx: strings.kindTpx, tp: strings.kindTp, suite: strings.kindSuite, case: strings.kindCase })[kind] || kind; }
    function validateName(input) { const ok = /^[A-Za-z0-9_]+$/.test(input.value.trim()); input.classList.toggle('invalid', !ok); return ok; }
    function validate() {
        valid = true;
        document.querySelectorAll('[data-param-name]').forEach(input => { if (!validateName(input)) {valid = false;} });
        document.querySelectorAll('[data-parameter-json]').forEach(input => {
            try {
                const obj = input.value.trim() ? JSON.parse(input.value) : {};
                if (!obj || Array.isArray(obj) || typeof obj !== 'object' || Object.keys(obj).some(name => !/^[A-Za-z0-9_]+$/.test(name))) {throw new Error();}
                input.classList.remove('invalid');
            } catch { input.classList.add('invalid'); valid = false; }
        });
    }
})();
