import getRecordsApex from '@salesforce/apex/CustomMetadataService.getRecords';
import getRecordByDeveloperNameApex from '@salesforce/apex/CustomMetadataService.getRecordByDeveloperName';

/**
 * Client-side loader for Custom Metadata Type configuration records
 * (CustomMetadataService.cls). Custom Metadata rarely changes within a
 * session - it's meant to be edited by an admin, not the running user - so
 * this caches by (type, fields) instead of re-querying on every component
 * that needs the same setting.
 */

const recordsCache = new Map();
const recordByNameCache = new Map();

function memoize(cache, key, load) {
    if (!cache.has(key)) {
        cache.set(
            key,
            load().catch((error) => {
                cache.delete(key);
                throw error;
            })
        );
    }
    return cache.get(key);
}

function toCacheKey(metadataApiName, fieldNames, extra) {
    const sortedFields = fieldNames ? [...fieldNames].sort() : [];
    return [metadataApiName, extra, sortedFields.join(',')].filter((part) => part !== undefined).join('::');
}

/**
 * @param {string} metadataApiName e.g. "ToolkitDemoSetting__mdt"
 * @param {string[]} [fieldNames]
 * @returns {Promise<Array<object>>}
 */
export function getMetadataRecords(metadataApiName, fieldNames = []) {
    const key = toCacheKey(metadataApiName, fieldNames);
    return memoize(recordsCache, key, () =>
        getRecordsApex({ metadataApiName, fieldNames: [...fieldNames].sort() })
    );
}

/**
 * @param {string} metadataApiName
 * @param {string} developerName
 * @param {string[]} [fieldNames]
 * @returns {Promise<object|null>}
 */
export function getMetadataRecordByDeveloperName(metadataApiName, developerName, fieldNames = []) {
    const key = toCacheKey(metadataApiName, fieldNames, developerName);
    return memoize(recordByNameCache, key, () =>
        getRecordByDeveloperNameApex({ metadataApiName, developerName, fieldNames: [...fieldNames].sort() })
    );
}

/** Clears every cached result - useful in tests, or to pick up a metadata change without a full page reload. */
export function clearMetadataCache() {
    recordsCache.clear();
    recordByNameCache.clear();
}
