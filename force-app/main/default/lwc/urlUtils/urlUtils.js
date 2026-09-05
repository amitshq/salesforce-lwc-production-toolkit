/**
 * Query-string helpers built on URLSearchParams/URL so components don't
 * hand-roll parsing (list-view filters, deep-linkable tabs, shareable
 * report URLs, wizard step state).
 */

/**
 * @param {string} [search] defaults to the current page's query string
 * @returns {Object<string, string|string[]>} repeated keys become arrays
 */
export function parseQueryParams(search = window.location.search) {
    const params = new URLSearchParams(search);
    const result = {};
    for (const key of params.keys()) {
        const values = params.getAll(key);
        result[key] = values.length > 1 ? values : values[0];
    }
    return result;
}

/**
 * @param {Object<string, *>} params null/undefined values are omitted; arrays produce repeated keys
 * @returns {string} e.g. "?a=1&b=2", or '' when there is nothing to serialize
 */
export function buildQueryString(params = {}) {
    const searchParams = new URLSearchParams();
    Object.keys(params).forEach((key) => {
        const value = params[key];
        if (value === null || value === undefined) {
            return;
        }
        if (Array.isArray(value)) {
            value.filter((item) => item !== null && item !== undefined).forEach((item) => searchParams.append(key, item));
        } else {
            searchParams.append(key, value);
        }
    });
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
}

/**
 * @param {string} name
 * @param {string} [search] defaults to the current page's query string
 * @returns {string|null}
 */
export function getQueryParam(name, search = window.location.search) {
    return new URLSearchParams(search).get(name);
}

/**
 * Returns a new URL string with `name` set to `value`, preserving every
 * other part of the URL (path, other params, hash).
 * @param {string} url
 * @param {string} name
 * @param {string} value
 * @returns {string}
 */
export function withQueryParam(url, name, value) {
    const parsed = new URL(url, getBaseUrl());
    parsed.searchParams.set(name, value);
    return toOutputUrl(parsed, url);
}

/**
 * @param {string} url
 * @param {string} name
 * @returns {string} a new URL string with `name` removed
 */
export function removeQueryParam(url, name) {
    const parsed = new URL(url, getBaseUrl());
    parsed.searchParams.delete(name);
    return toOutputUrl(parsed, url);
}

function getBaseUrl() {
    return typeof window !== 'undefined' && window.location ? window.location.origin : 'https://example.com';
}

// Preserves relative URLs as relative, since callers usually pass a path.
function toOutputUrl(parsedUrl, originalUrl) {
    const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(originalUrl);
    return isAbsolute ? parsedUrl.toString() : parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
}
