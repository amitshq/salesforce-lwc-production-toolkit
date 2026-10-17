/**
 * The logic behind c-csv-import-wizard, kept free of UI so it can be tested
 * and reused: matching CSV headers to Salesforce fields, converting cell text
 * to typed values, and validating every row before anything is sent to the
 * server.
 *
 * A "field" is { apiName, label, type, required }, the same shape
 * c-dynamic-form uses.
 */

export const ID_FIELD = 'Id';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const SALESFORCE_ID = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;
const GROUPED_NUMBER = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NUMERIC_TYPES = new Set(['number', 'currency', 'percent', 'integer', 'double']);
const BOOLEAN_TYPES = new Set(['checkbox', 'boolean']);
const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'x']);
const FALSE_WORDS = new Set(['false', 'no', 'n', '0']);

function normalize(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

/**
 * Guesses which field each CSV column belongs to by comparing the header with
 * each field's API name and label, ignoring case, spaces and punctuation. A
 * header of "Id" maps to the record Id (an update). Each field is used once.
 * @param {string[]} headers
 * @param {Array<{apiName: string, label?: string}>} fields
 * @returns {string[]} one API name per header, '' where there was no match
 */
export function autoMapColumns(headers, fields) {
    const used = new Set();
    return headers.map((header) => {
        const key = normalize(header);
        if (!key) {
            return '';
        }
        if (key === 'id' && !used.has(ID_FIELD)) {
            used.add(ID_FIELD);
            return ID_FIELD;
        }
        const match = fields.find(
            (field) => !used.has(field.apiName) && (normalize(field.apiName) === key || normalize(field.label) === key)
        );
        if (match) {
            used.add(match.apiName);
            return match.apiName;
        }
        return '';
    });
}

/**
 * Checks a column mapping before rows are validated.
 * @param {string[]} mapping
 * @param {Array<{apiName: string, label?: string, required?: boolean}>} fields
 * @returns {string[]} problems; empty means the mapping is usable
 */
export function validateMapping(mapping, fields) {
    const problems = [];
    const mapped = mapping.filter(Boolean);
    if (!mapped.length) {
        return ['Map at least one column to a field.'];
    }
    const columnCounts = new Map();
    mapped.forEach((apiName) => columnCounts.set(apiName, (columnCounts.get(apiName) || 0) + 1));
    columnCounts.forEach((count, apiName) => {
        if (count > 1) {
            const field = fields.find((f) => f.apiName === apiName);
            problems.push(`"${field ? field.label || field.apiName : apiName}" is mapped to more than one column.`);
        }
    });
    // Required fields only matter when creating records; an update (Id mapped) can be partial.
    if (!columnCounts.has(ID_FIELD)) {
        fields
            .filter((field) => field.required && !columnCounts.has(field.apiName))
            .forEach((field) => problems.push(`Required field "${field.label || field.apiName}" is not mapped to a column.`));
    }
    return problems;
}

/**
 * Converts one cell of text to the value Salesforce expects for a field type.
 * @param {string} raw
 * @param {string} [type='text']
 * @returns {{skip: true} | {value: *} | {error: string}} skip means the cell was empty
 */
export function coerceValue(raw, type = 'text') {
    const text = String(raw ?? '').trim();
    if (text === '') {
        return { skip: true };
    }

    if (NUMERIC_TYPES.has(type)) {
        if (PLAIN_NUMBER.test(text)) {
            return { value: Number(text) };
        }
        if (GROUPED_NUMBER.test(text)) {
            return { value: Number(text.replace(/,/g, '')) };
        }
        return { error: `"${text}" is not a valid number.` };
    }

    if (BOOLEAN_TYPES.has(type)) {
        const word = text.toLowerCase();
        if (TRUE_WORDS.has(word)) {
            return { value: true };
        }
        if (FALSE_WORDS.has(word)) {
            return { value: false };
        }
        return { error: `"${text}" is not a valid true/false value (use true, false, yes, no, 1 or 0).` };
    }

    if (type === 'date') {
        const parsed = ISO_DATE.test(text) ? new Date(`${text}T00:00:00Z`) : null;
        if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
            return { error: `"${text}" is not a valid date (use YYYY-MM-DD).` };
        }
        return { value: text };
    }

    if (type === 'datetime') {
        const parsed = ISO_DATETIME.test(text) ? new Date(text) : null;
        if (!parsed || Number.isNaN(parsed.getTime())) {
            return { error: `"${text}" is not a valid date and time (use YYYY-MM-DDTHH:mm:ssZ).` };
        }
        return { value: parsed.toISOString() };
    }

    if (type === 'email' && !EMAIL.test(text)) {
        return { error: `"${text}" is not a valid email address.` };
    }

    return { value: text };
}

/**
 * Turns CSV rows into records, collecting every problem instead of stopping
 * at the first. A row with any problem is left out of `records`; empty cells
 * are not sent, so an update never blanks a field by accident.
 * @param {{rows: string[][], mapping: string[], fields: Array<{apiName: string, label?: string, type?: string, required?: boolean}>}} args
 * @returns {{records: Array<{rowNumber: number, fields: object}>, errors: Array<{rowNumber: number, fieldLabel: string, message: string}>, invalidRowCount: number, emptyRowCount: number}}
 *   rowNumber counts the header as row 1, so the first data row is 2, matching what a spreadsheet shows.
 */
export function buildRecords({ rows, mapping, fields }) {
    const records = [];
    const errors = [];
    let invalidRowCount = 0;
    let emptyRowCount = 0;

    rows.forEach((cells, index) => {
        const rowNumber = index + 2;
        const mappedCellsAreBlank = mapping.every(
            (apiName, columnIndex) => !apiName || String(cells[columnIndex] ?? '').trim() === ''
        );
        if (mappedCellsAreBlank) {
            emptyRowCount++;
            return;
        }
        const values = {};
        let rowHasError = false;
        const fail = (fieldLabel, message) => {
            errors.push({ rowNumber, fieldLabel, message });
            rowHasError = true;
        };

        mapping.forEach((apiName, columnIndex) => {
            if (!apiName) {
                return;
            }
            const raw = cells[columnIndex];
            if (apiName === ID_FIELD) {
                const id = String(raw ?? '').trim();
                if (id === '') {
                    return;
                }
                if (!SALESFORCE_ID.test(id)) {
                    fail('Id', `"${id}" is not a valid Salesforce Id.`);
                    return;
                }
                values[ID_FIELD] = id;
                return;
            }
            const field = fields.find((f) => f.apiName === apiName);
            const result = coerceValue(raw, field ? field.type : 'text');
            if (result.error) {
                fail(field ? field.label || field.apiName : apiName, result.error);
            } else if (!result.skip) {
                values[apiName] = result.value;
            }
        });

        if (!values[ID_FIELD]) {
            fields
                .filter((field) => field.required && values[field.apiName] === undefined && mapping.includes(field.apiName))
                .forEach((field) => fail(field.label || field.apiName, 'A value is required.'));
        }

        if (rowHasError) {
            invalidRowCount++;
        } else {
            records.push({ rowNumber, fields: values });
        }
    });

    return { records, errors, invalidRowCount, emptyRowCount };
}
