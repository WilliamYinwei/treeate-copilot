import { t } from './i18n';
import { PARAMETER_NAME } from './model';

/** 参表 CSV 的一行：depth 1=测试工程，2=测试套，3=测试项。 */
export interface ParameterCsvRow {
    depth: number;
    name: string;
    description: string;
    parameters: Record<string, string>;
    line: number;
}

export interface ParameterCsv {
    columns: string[];
    rows: ParameterCsvRow[];
}

export type ParameterCsvInputRow = Omit<ParameterCsvRow, 'line'>;

/** 生成 UTF-8 BOM + CRLF 的参表 CSV，空值保留为空字段。 */
export function serializeParameterCsv(columns: string[], rows: ParameterCsvInputRow[]): string {
    const lines = [['Name', 'Description', ...columns].map(escapeField).join(',')];
    for (const row of rows) {
        const fields = [`${' '.repeat(row.depth)}${row.name}`, row.description, ...columns.map(column => row.parameters[column] ?? '')];
        lines.push(fields.map(escapeField).join(','));
    }
    return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** 解析参表 CSV，并校验表头、层级和列数；任何格式问题都会抛错。 */
export function parseParameterCsv(content: string): ParameterCsv {
    const records = parseRecords(content.replace(/^\uFEFF/, ''));
    if (!records.length) { throw new Error(t('csv.empty')); }
    const header = records[0].fields.map(field => field.trim());
    if (header.length < 2 || header[0] !== 'Name' || header[1] !== 'Description') {
        throw new Error(t('csv.header'));
    }
    const columns = header.slice(2);
    const seen = new Set<string>();
    for (const column of columns) {
        if (!PARAMETER_NAME.test(column)) { throw new Error(t('csv.invalidColumn', column)); }
        if (seen.has(column)) { throw new Error(t('csv.duplicateColumn', column)); }
        seen.add(column);
    }

    const rows: ParameterCsvRow[] = [];
    let previousDepth = 0;
    for (const record of records.slice(1)) {
        if (record.fields.length === 1 && record.fields[0] === '') { continue; }
        if (record.fields.length !== header.length) {
            throw new Error(t('csv.columnCount', record.line, record.fields.length, header.length));
        }
        const match = /^( *)(.*)$/.exec(record.fields[0]);
        const depth = match ? match[1].length : 0;
        const name = match ? match[2].trim() : '';
        if (!name) { throw new Error(t('csv.emptyName', record.line)); }
        if (depth < 1 || depth > 3) { throw new Error(t('csv.invalidDepth', record.line)); }
        if (!rows.length && depth !== 1) { throw new Error(t('csv.firstMustBeProject', record.line)); }
        if (depth > previousDepth + 1) { throw new Error(t('csv.depthJump', record.line)); }
        rows.push({
            depth, name, description: record.fields[1], line: record.line,
            parameters: Object.fromEntries(columns.map((column, index) => [column, record.fields[index + 2]]))
        });
        previousDepth = depth;
    }
    if (!rows.length) { throw new Error(t('csv.noRows')); }
    return { columns, rows };
}

/** 解码 CSV 原始字节：识别 UTF-8/UTF-16 BOM，无 BOM 时按 UTF-8 校验，失败则回退 GBK（Excel 中文 CSV）。 */
export function decodeCsvBuffer(buffer: Uint8Array): string {
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        return new TextDecoder('utf-8').decode(buffer.subarray(3));
    }
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
        return new TextDecoder('utf-16le').decode(buffer.subarray(2));
    }
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        try { return new TextDecoder('gbk').decode(buffer); }
        catch { return new TextDecoder('utf-8').decode(buffer); }
    }
}

interface CsvRecord { fields: string[]; line: number; }

function escapeField(value: string): string {
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function parseRecords(content: string): CsvRecord[] {
    const records: CsvRecord[] = [];
    let fields: string[] = [];
    let field = '';
    let quoted = false;
    let line = 1;
    let recordLine = 1;
    let index = 0;
    const pushField = (): void => { fields.push(field); field = ''; };
    const pushRecord = (): void => { pushField(); records.push({ fields, line: recordLine }); fields = []; };

    while (index < content.length) {
        const char = content[index];
        if (quoted) {
            if (char === '"') {
                if (content[index + 1] === '"') { field += '"'; index += 2; continue; }
                quoted = false; index += 1; continue;
            }
            if (char === '\r' || char === '\n') {
                if (char === '\r' && content[index + 1] === '\n') { field += '\r\n'; index += 2; } else { field += char; index += 1; }
                line += 1; continue;
            }
            field += char; index += 1; continue;
        }
        if (char === '"') {
            if (field.length) { throw new Error(t('csv.quoteStart', line)); }
            quoted = true; index += 1; continue;
        }
        if (char === ',') { pushField(); index += 1; continue; }
        if (char === '\r' || char === '\n') {
            if (char === '\r' && content[index + 1] === '\n') { index += 2; } else { index += 1; }
            pushRecord(); line += 1; recordLine = line; continue;
        }
        field += char; index += 1;
    }
    if (quoted) { throw new Error(t('csv.unclosedQuote', recordLine)); }
    if (field.length || fields.length) { pushRecord(); }
    return records;
}
