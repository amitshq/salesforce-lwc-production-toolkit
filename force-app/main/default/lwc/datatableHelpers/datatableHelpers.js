import LOCALE from '@salesforce/i18n/locale';
import CURRENCY from '@salesforce/i18n/currency';
import { getNestedValue } from 'c/objectUtils';

/**
 * Small pure helpers behind c-enterprise-datatable and the aggregate components:
 * row actions, record links, sorting and chunking rows, and formatting totals.
 * Kept free of UI so they can be tested and reused.
 */

const BUILT_IN_ROW_ACTIONS = {
    view: { label: 'View', name: 'view' },
    edit: { label: 'Edit', name: 'edit' },
    delete: { label: 'Delete', name: 'delete' }
};

export const DEFAULT_RECORD_URL_TEMPLATE = '/lightning/r/{recordId}/view';

/**
 * Turns a row-actions setting into lightning-datatable's rowActions shape. Accepts a
 * comma-separated string ("view,edit,delete", handy in App Builder) or an array of
 * names and `{ label, name, iconName }` objects. view, edit and delete get default
 * labels; anything else needs a label or uses its name. Duplicate names are dropped.
 * @param {string|Array<string|{label?: string, name: string, iconName?: string}>} value
 * @returns {Array<{label: string, name: string, iconName?: string}>}
 */
export function normalizeRowActions(value) {
    const items = typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : [];
    const seen = new Set();
    const actions = [];
    items.forEach((item) => {
        const action = typeof item === 'string' ? { name: item.trim() } : { ...(item || {}) };
        const name = typeof action.name === 'string' ? action.name.trim() : '';
        if (!name || seen.has(name)) {
            return;
        }
        seen.add(name);
        const builtIn = BUILT_IN_ROW_ACTIONS[name];
        actions.push({ ...builtIn, ...action, name, label: action.label || (builtIn ? builtIn.label : name) });
    });
    return actions;
}

/**
 * Builds a record's URL from a template containing `{recordId}`.
 * @param {string} template
 * @param {string} recordId
 * @returns {string|undefined}
 */
export function recordUrl(template, recordId) {
    if (!recordId) {
        return undefined;
    }
    return (template || DEFAULT_RECORD_URL_TEMPLATE).split('{recordId}').join(encodeURIComponent(recordId));
}

/**
 * The path of the related record's Id for a relationship path: Owner.Name -> Owner.Id.
 * @param {string} fieldPath
 * @returns {string}
 */
export function relatedIdPath(fieldPath) {
    const parts = String(fieldPath).split('.');
    parts[parts.length - 1] = 'Id';
    return parts.join('.');
}

/**
 * Splits a list into consecutive chunks of at most `size` items.
 * @param {Array} items
 * @param {number} size
 * @returns {Array<Array>}
 */
export function toChunks(items, size) {
    const step = Math.max(1, Math.floor(Number(size)) || 1);
    const chunks = [];
    for (let start = 0; start < (items || []).length; start += step) {
        chunks.push(items.slice(start, start + step));
    }
    return chunks;
}

function readValue(row, fieldName) {
    const alias = fieldName.replace(/\./g, '_');
    const value = row[alias] !== undefined ? row[alias] : getNestedValue(row, fieldName);
    return value === '' ? null : value;
}

/**
 * Compares two rows the way GenericQueryService orders them: by the field, ascending
 * or descending, with empty values last either way. Text compares without regard to
 * case or accents; ISO dates compare as text, which orders them correctly.
 * @param {object} a
 * @param {object} b
 * @param {string} fieldName may be a relationship path (Owner.Name)
 * @param {'asc'|'desc'} [direction='asc']
 * @returns {number}
 */
export function compareRows(a, b, fieldName, direction = 'asc') {
    const left = readValue(a, fieldName);
    const right = readValue(b, fieldName);
    const leftEmpty = left === null || left === undefined;
    const rightEmpty = right === null || right === undefined;
    if (leftEmpty || rightEmpty) {
        return leftEmpty === rightEmpty ? 0 : leftEmpty ? 1 : -1;
    }
    let result;
    if (typeof left === 'number' && typeof right === 'number') {
        result = left - right;
    } else if (typeof left === 'boolean' && typeof right === 'boolean') {
        result = Number(left) - Number(right);
    } else {
        result = String(left).localeCompare(String(right), LOCALE, { sensitivity: 'base' });
    }
    return String(direction).toLowerCase() === 'desc' ? -result : result;
}

/**
 * Sorts a copy of the rows with compareRows. The sort is stable, so rows that tie keep
 * their order (Id order, for rows read with GenericQueryService.queryBatch).
 */
export function sortRows(rows, fieldName, direction) {
    const copy = [...(rows || [])];
    if (!fieldName) {
        return copy;
    }
    return copy.sort((a, b) => compareRows(a, b, fieldName, direction));
}

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/**
 * Plain text from rich-text HTML, for a CSV cell: block ends become line breaks,
 * tags are removed and the common entities decoded.
 * @param {string} html
 * @returns {string}
 */
export function richTextToPlainText(html) {
    if (html === null || html === undefined) {
        return '';
    }
    return String(html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])
        .replace(/\n{2,}/g, '\n')
        .trim();
}

/**
 * Formats a number for a totals row or a ranked list.
 * @param {*} value
 * @param {'number'|'currency'|'percent'} [format='number'] percent values are already in
 *   percent (Salesforce stores 12.5 for 12.5%)
 * @param {string} [currencyCode] defaults to the user's currency
 * @returns {string} an em dash when there is no value
 */
export function formatNumber(value, format = 'number', currencyCode) {
    if (value === null || value === undefined || value === '') {
        return '—';
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
        return String(value);
    }
    if (format === 'currency') {
        return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: currencyCode || CURRENCY, maximumFractionDigits: 2 }).format(
            numeric
        );
    }
    const text = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(numeric);
    return format === 'percent' ? `${text}%` : text;
}
