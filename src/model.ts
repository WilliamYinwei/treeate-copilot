export type JsonObject = Record<string, unknown>;
export type NodeKind = 'project' | 'suite' | 'case' | 'tp';

export interface TreeAteNode {
    id: string;
    kind: NodeKind;
    name: string;
    description: string;
    tpPath?: string;
    suiteIndex?: number;
    caseIndex?: number;
}

export interface ProjectFile {
    path: string;
    data: JsonObject;
}

export interface ProjectSnapshot {
    rootDir: string;
    tpx: ProjectFile;
    tpFiles: ProjectFile[];
}

export interface ParameterCell {
    value: string;
    inherited: boolean;
    source: 'project' | 'suite' | 'case' | 'none';
}

export interface ParameterRow {
    nodeId: string;
    label: string;
    cells: Record<string, ParameterCell>;
}

export interface ParameterTableData {
    columns: string[];
    rows: ParameterRow[];
}

export const PARAMETER_NAME = /^[A-Za-z0-9_]+$/;

export function asObject(value: unknown): JsonObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonObject
        : {};
}

export function asArray(value: unknown): JsonObject[] {
    // Return the original array: callers intentionally mutate TreeATE's arrays in place.
    return Array.isArray(value) ? value as JsonObject[] : [];
}

export function text(value: unknown): string {
    if (value === undefined || value === null) { return ''; }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** Reads both TreeATE parameter representations: object maps and [{Name, Value, Desc}]. */
export function readParameters(value: unknown): Record<string, string> {
    const result: Record<string, string> = {};
    if (Array.isArray(value)) {
        for (const entry of value) {
            const obj = asObject(entry);
            const name = text(obj.Name || obj.name);
            if (name) { result[name] = text(obj.Value ?? obj.value); }
        }
        return result;
    }
    for (const [name, raw] of Object.entries(asObject(value))) {
        const obj = asObject(raw);
        result[name] = Object.keys(obj).length && ('Value' in obj || 'value' in obj)
            ? text(obj.Value ?? obj.value)
            : text(raw);
    }
    return result;
}

/** Reads the optional Desc/desc metadata without changing the parameter value representation. */
export function readParameterDescriptions(value: unknown): Record<string, string> {
    const result: Record<string, string> = {};
    if (Array.isArray(value)) {
        for (const entry of value) {
            const obj = asObject(entry);
            const name = text(obj.Name || obj.name);
            if (name) { result[name] = text(obj.Desc ?? obj.desc); }
        }
        return result;
    }
    for (const [name, raw] of Object.entries(asObject(value))) {
        const obj = asObject(raw);
        result[name] = text(obj.Desc ?? obj.desc);
    }
    return result;
}

/** Updates in place without converting the representation or deleting vendor-specific fields. */
export function writeParameters(owner: JsonObject, next: Record<string, string>, key = 'Parameter'): void {
    const current = owner[key];
    if (Array.isArray(current)) {
        const byName = new Map<string, JsonObject>();
        for (const entry of current) {
            const obj = asObject(entry);
            byName.set(text(obj.Name || obj.name), obj);
        }
        owner[key] = Object.entries(next).map(([name, value]) => {
            const existing = byName.get(name);
            if (existing) {
                if ('value' in existing && !('Value' in existing)) { existing.value = value; }
                else { existing.Value = value; }
                return existing;
            }
            return { Name: name, Value: value, Desc: '' };
        });
        return;
    }

    const oldObject = asObject(current);
    const replacement: JsonObject = {};
    for (const [name, value] of Object.entries(next)) {
        const previous = oldObject[name];
        const previousObject = asObject(previous);
        if (Object.keys(previousObject).length && ('Value' in previousObject || 'value' in previousObject)) {
            replacement[name] = {
                ...previousObject,
                ...('value' in previousObject && !('Value' in previousObject) ? { value } : { Value: value })
            };
        } else {
            replacement[name] = value;
        }
    }
    owner[key] = replacement;
}

/** Updates Desc/desc metadata and preserves array/object form and vendor-specific fields where possible. */
export function writeParameterDescriptions(owner: JsonObject, next: Record<string, string>, key = 'Parameter'): void {
    const current = owner[key];
    if (Array.isArray(current)) {
        for (const entry of current) {
            const obj = asObject(entry);
            const name = text(obj.Name || obj.name);
            if (!name || !(name in next)) { continue; }
            if ('desc' in obj && !('Desc' in obj)) { obj.desc = next[name]; }
            else { obj.Desc = next[name]; }
        }
        return;
    }

    const parameters = asObject(current);
    for (const [name, description] of Object.entries(next)) {
        if (!(name in parameters)) { continue; }
        const raw = parameters[name];
        if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
            const obj = raw as JsonObject;
            if ('desc' in obj && !('Desc' in obj)) { obj.desc = description; }
            else { obj.Desc = description; }
        } else if (description) {
            parameters[name] = { Value: text(raw), Desc: description };
        }
    }
}

export function assertParameterNames(parameters: Record<string, string>): void {
    const invalid = Object.keys(parameters).find(name => !PARAMETER_NAME.test(name));
    if (invalid) { throw new Error(`参数名“${invalid}”不合法，只允许字母、数字和下划线。`); }
}
