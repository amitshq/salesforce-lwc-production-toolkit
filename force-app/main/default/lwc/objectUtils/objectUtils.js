/**
 * Deep clone / deep compare / safe nested-path access for plain data
 * (Apex DTOs, wire results, draft-value objects) - the stuff LWC's
 * reactivity model makes surprisingly easy to get wrong with naive
 * spread/reference copies.
 */

/**
 * Recursively clones plain objects, arrays, Date, Map and Set. Functions and
 * class instances with custom prototypes are copied by reference, since
 * there is no generically correct way to clone arbitrary behavior.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepClone(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (value instanceof Date) {
        return new Date(value.getTime());
    }
    if (Array.isArray(value)) {
        return value.map((item) => deepClone(item));
    }
    if (value instanceof Map) {
        const clone = new Map();
        value.forEach((v, k) => clone.set(deepClone(k), deepClone(v)));
        return clone;
    }
    if (value instanceof Set) {
        const clone = new Set();
        value.forEach((v) => clone.add(deepClone(v)));
        return clone;
    }
    if (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) {
        const clone = {};
        Object.keys(value).forEach((key) => {
            clone[key] = deepClone(value[key]);
        });
        return clone;
    }
    // Unknown class instance (e.g. a proxy from the wire service): return as-is.
    return value;
}

/**
 * Deep, order-independent-for-objects equality check.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function isEqual(a, b) {
    if (Object.is(a, b)) {
        return true;
    }
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
        return false;
    }
    if (a instanceof Date || b instanceof Date) {
        return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
            return false;
        }
        return a.every((item, index) => isEqual(item, b[index]));
    }
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    return aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && isEqual(a[key], b[key]));
}

function toPathTokens(path) {
    if (Array.isArray(path)) {
        return path;
    }
    return String(path)
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .filter((token) => token !== '');
}

/**
 * Reads a nested value using a dot/bracket path (e.g. "contacts[0].email"),
 * returning `defaultValue` instead of throwing when any segment is missing.
 * @param {object} obj
 * @param {string|Array<string>} path
 * @param {*} [defaultValue]
 */
export function getNestedValue(obj, path, defaultValue) {
    const tokens = toPathTokens(path);
    let current = obj;
    for (const token of tokens) {
        if (current === null || current === undefined) {
            return defaultValue;
        }
        current = current[token];
    }
    return current === undefined ? defaultValue : current;
}

/**
 * Returns a new object with `value` set at the nested path, deep-cloning
 * only the branch that changed. Intermediate containers are created as
 * plain objects unless the next token is a numeric index, in which case an
 * array is created.
 * @param {object} obj
 * @param {string|Array<string>} path
 * @param {*} value
 */
export function setNestedValue(obj, path, value) {
    const tokens = toPathTokens(path);
    if (tokens.length === 0) {
        return obj;
    }
    const root = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
    let current = root;

    for (let i = 0; i < tokens.length - 1; i++) {
        const token = tokens[i];
        const nextToken = tokens[i + 1];
        const existing = current[token];
        const isNextArrayIndex = /^\d+$/.test(nextToken);

        if (existing && typeof existing === 'object') {
            current[token] = Array.isArray(existing) ? [...existing] : { ...existing };
        } else {
            current[token] = isNextArrayIndex ? [] : {};
        }
        current = current[token];
    }

    current[tokens[tokens.length - 1]] = value;
    return root;
}
