/**
 * JSON helpers that don't throw - handy for debug panels and anywhere a
 * malformed payload (an unexpected Apex response, a bad localStorage value)
 * shouldn't blow up the component.
 */

/**
 * @param {string} jsonString
 * @param {*} [fallback]
 * @returns {*} the parsed value, or `fallback` if parsing fails
 */
export function safeParse(jsonString, fallback = null) {
    if (typeof jsonString !== 'string') {
        return fallback;
    }
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return fallback;
    }
}

/**
 * @param {*} value
 * @param {string} [fallback]
 * @param {number} [indent]
 * @returns {string}
 */
export function safeStringify(value, fallback = '', indent) {
    try {
        const result = JSON.stringify(value, null, indent);
        return result === undefined ? fallback : result;
    } catch (e) {
        return fallback;
    }
}

/**
 * Accepts either a JSON string or a JS value and returns an indented JSON
 * string, falling back to the original input (stringified) if it cannot be
 * formatted.
 * @param {*} value
 * @param {number} [indent=2]
 * @returns {string}
 */
const PARSE_FAILED = Symbol('jsonUtils.parseFailed');

export function prettyPrint(value, indent = 2) {
    if (typeof value !== 'string') {
        return safeStringify(value, String(value), indent);
    }
    const target = safeParse(value, PARSE_FAILED);
    if (target === PARSE_FAILED) {
        return value;
    }
    return safeStringify(target, value, indent);
}

/**
 * @param {string} value
 * @returns {boolean}
 */
export function isValidJson(value) {
    if (typeof value !== 'string') {
        return false;
    }
    try {
        JSON.parse(value);
        return true;
    } catch (e) {
        return false;
    }
}
