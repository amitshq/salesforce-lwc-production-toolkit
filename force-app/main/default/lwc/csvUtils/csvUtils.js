/**
 * CSV helpers for exporting datatable / bulk-action selections.
 * Escape rules follow RFC 4180: fields containing commas, quotes, or
 * newlines are quoted, and embedded quotes are doubled.
 */

/**
 * @param {*} value
 * @returns {string}
 */
export function escapeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    const str = String(value);
    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Builds a CSV string from row objects and column definitions.
 *
 * Columns may be plain field-name strings or datatable-style objects
 * (`{ label, fieldName }`). Relationship paths (`Owner.Name`) are read
 * from the flattened alias (`Owner_Name`) first, matching
 * `c-enterprise-datatable`'s server-side flatten, then fall back to the
 * dotted key.
 *
 * @param {object[]} [rows=[]]
 * @param {Array<{label?: string, fieldName: string}|string>} [columns=[]]
 * @returns {string}
 */
export function rowsToCsv(rows = [], columns = []) {
    const normalized = columns.map((col) => {
        if (typeof col === 'string') {
            return { label: col, fieldName: col };
        }
        return {
            label: col.label ?? col.fieldName,
            fieldName: col.fieldName
        };
    });

    const header = normalized.map((col) => escapeCsvValue(col.label)).join(',');
    const lines = (rows || []).map((row) =>
        normalized
            .map((col) => {
                const flatKey = col.fieldName.replace(/\./g, '_');
                const value = row[flatKey] ?? row[col.fieldName] ?? '';
                return escapeCsvValue(value);
            })
            .join(',')
    );

    return [header, ...lines].join('\n');
}

/**
 * Triggers a browser file download of the given CSV string.
 * @param {string} filename
 * @param {string} csvContent
 */
export function downloadCsv(filename, csvContent) {
    const safeName = filename?.endsWith('.csv') ? filename : `${filename || 'export'}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', safeName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Convenience wrapper: build CSV from rows/columns and download it.
 * @param {object[]} rows
 * @param {Array<{label?: string, fieldName: string}|string>} columns
 * @param {string} [filename='export.csv']
 * @returns {string} the CSV content that was downloaded
 */
export function exportRowsToCsv(rows, columns, filename = 'export.csv') {
    const csv = rowsToCsv(rows, columns);
    downloadCsv(filename, csv);
    return csv;
}
