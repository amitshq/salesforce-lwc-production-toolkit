import { getNestedValue } from 'c/objectUtils';

/**
 * CSV helpers for exporting datatable / bulk-action selections.
 * Escape rules follow RFC 4180: fields containing commas, quotes, or
 * newlines are quoted, embedded quotes are doubled, and records are
 * separated by CRLF.
 */

const UTF8_BOM = '﻿';
const REVOKE_DELAY_MS = 1000;
// Characters a spreadsheet treats as the start of a formula when a cell begins with them.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

function toCellString(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (Array.isArray(value)) {
        return value.map(toCellString).join('; ');
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}

/**
 * Converts a value to a single RFC 4180 field. Dates become ISO strings,
 * arrays are joined with "; ", and other objects are JSON-encoded.
 * @param {*} value
 * @returns {string}
 */
export function escapeCsvValue(value) {
    const str = toCellString(value);
    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Prefixes a string that a spreadsheet would run as a formula (starts with
 * `=`, `+`, `-`, `@`, tab or CR) with a single quote so it opens as text.
 * Non-strings and plain numeric strings such as "-5" are returned unchanged.
 * @param {*} value
 * @returns {*}
 */
export function neutralizeFormula(value) {
    if (typeof value !== 'string' || !FORMULA_TRIGGER.test(value) || PLAIN_NUMBER.test(value)) {
        return value;
    }
    return `'${value}`;
}

function readCell(row, fieldName) {
    const flatKey = fieldName.replace(/\./g, '_');
    return row[flatKey] ?? getNestedValue(row, fieldName) ?? row[fieldName] ?? '';
}

/**
 * Builds a CSV string from row objects and column definitions.
 *
 * Columns may be plain field-name strings or datatable-style objects
 * (`{ label, fieldName }`). Columns without a `fieldName` (row-action or
 * button columns) are skipped. Relationship paths (`Owner.Name`) are read
 * from the flattened alias (`Owner_Name`) first, matching
 * `c-enterprise-datatable`, then from the nested object
 * (`row.Owner.Name`) as returned by Apex, then from a literal dotted key.
 *
 * Text cells that would be run as spreadsheet formulas are prefixed with a
 * single quote unless `neutralizeFormulas` is `false`.
 *
 * @param {object[]} [rows=[]]
 * @param {Array<{label?: string, fieldName?: string}|string>} [columns=[]]
 * @param {{neutralizeFormulas?: boolean}} [options]
 * @returns {string}
 */
export function rowsToCsv(rows = [], columns = [], { neutralizeFormulas = true } = {}) {
    const normalized = columns
        .map((col) => {
            if (typeof col === 'string') {
                return { label: col, fieldName: col };
            }
            return { label: col?.label ?? col?.fieldName, fieldName: col?.fieldName };
        })
        .filter((col) => typeof col.fieldName === 'string' && col.fieldName);

    const header = normalized.map((col) => escapeCsvValue(col.label)).join(',');
    const lines = (rows || []).filter(Boolean).map((row) =>
        normalized
            .map((col) => {
                const value = readCell(row, col.fieldName);
                return escapeCsvValue(neutralizeFormulas ? neutralizeFormula(value) : value);
            })
            .join(',')
    );

    return [header, ...lines].join('\r\n');
}

/**
 * Parses CSV text into an array of rows (arrays of strings), following
 * RFC 4180: quoted fields may contain commas, quotes (doubled) and newlines;
 * records end at CRLF, LF or CR. A leading UTF-8 BOM is ignored and fully
 * blank lines are dropped.
 * @param {string} text
 * @returns {string[][]}
 * @throws {Error} if a quoted field is never closed
 */
export function parseCsv(text) {
    const source = typeof text === 'string' && text.charCodeAt(0) === 0xfeff ? text.slice(1) : String(text ?? '');
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (inQuotes) {
            if (ch === '"') {
                if (source[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"' && field === '') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\r' || ch === '\n') {
            if (ch === '\r' && source[i + 1] === '\n') {
                i++;
            }
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += ch;
        }
    }

    if (inQuotes) {
        throw new Error('The file has a quoted field that is never closed.');
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/**
 * Parses CSV text whose first record is a header row. Data rows are padded
 * with empty strings, or cut, to the header's width.
 * @param {string} text
 * @returns {{headers: string[], rows: string[][]}}
 * @throws {Error} if the text has no header row, or a quoted field is never closed
 */
export function parseCsvTable(text) {
    const [headerRow, ...dataRows] = parseCsv(text);
    if (!headerRow) {
        throw new Error('The file is empty.');
    }
    const headers = headerRow.map((header) => header.trim());
    const rows = dataRows.map((cells) => headers.map((_, index) => cells[index] ?? ''));
    return { headers, rows };
}

/**
 * Triggers a browser file download of the given CSV string. A UTF-8 BOM is
 * prepended so Excel reads non-ASCII text correctly.
 * @param {string} filename
 * @param {string} csvContent
 */
export function downloadCsv(filename, csvContent) {
    const safeName = filename?.endsWith('.csv') ? filename : `${filename || 'export'}.csv`;
    const blob = new Blob([UTF8_BOM, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', safeName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoking synchronously after click() can cancel the download in some browsers.
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

/**
 * Convenience wrapper: build CSV from rows/columns and download it.
 * @param {object[]} rows
 * @param {Array<{label?: string, fieldName?: string}|string>} columns
 * @param {string} [filename='export.csv']
 * @param {{neutralizeFormulas?: boolean}} [options]
 * @returns {string} the CSV content that was downloaded
 */
export function exportRowsToCsv(rows, columns, filename = 'export.csv', options) {
    const csv = rowsToCsv(rows, columns, options);
    downloadCsv(filename, csv);
    return csv;
}
