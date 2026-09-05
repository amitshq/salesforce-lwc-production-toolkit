import checkObjectAccessApex from '@salesforce/apex/PermissionService.checkObjectAccess';
import checkFieldAccessApex from '@salesforce/apex/PermissionService.checkFieldAccess';
import hasCustomPermissionApex from '@salesforce/apex/PermissionService.hasCustomPermission';

/**
 * Client-side wrapper around PermissionService.cls. A component that needs
 * to gate a "Delete" button or an inline-edit column on object/field/custom
 * permission access would otherwise fire the same imperative Apex call on
 * every render; this memoizes by argument for the lifetime of the tab, since
 * a user's permissions don't change mid-session.
 */

const objectAccessCache = new Map();
const fieldAccessCache = new Map();
const customPermissionCache = new Map();

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

/**
 * @param {string} objectApiName
 * @returns {Promise<{isAccessible: boolean, isCreateable: boolean, isUpdateable: boolean, isDeletable: boolean}>}
 */
export function getObjectAccess(objectApiName) {
    return memoize(objectAccessCache, objectApiName, () => checkObjectAccessApex({ objectApiName }));
}

/**
 * @param {string} objectApiName
 * @param {string[]} fieldNames
 * @returns {Promise<Array<{fieldName: string, readable: boolean, editable: boolean}>>}
 */
export function getFieldAccess(objectApiName, fieldNames) {
    const sortedFields = [...fieldNames].sort();
    const key = `${objectApiName}:${sortedFields.join(',')}`;
    return memoize(fieldAccessCache, key, () => checkFieldAccessApex({ objectApiName, fieldNames: sortedFields }));
}

/**
 * @param {string} developerName
 * @returns {Promise<boolean>}
 */
export function hasCustomPermission(developerName) {
    return memoize(customPermissionCache, developerName, () => hasCustomPermissionApex({ developerName }));
}

/** Clears every cached result - useful in tests, or after a permission set assignment changes mid-session. */
export function clearPermissionCache() {
    objectAccessCache.clear();
    fieldAccessCache.clear();
    customPermissionCache.clear();
}
