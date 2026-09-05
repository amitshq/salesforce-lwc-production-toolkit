import { refreshApex } from '@salesforce/apex';
import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';

/**
 * After a DML happens outside Lightning Data Service (an imperative Apex
 * save, a Platform Event, a background job), two separate things need to
 * happen for the UI to catch up:
 *  1. Any @wire'd Apex result this component holds needs refreshApex().
 *  2. Every *other* LDS-backed component on the page (record forms,
 *     related lists, the record page itself) needs to be told the record
 *     changed, via notifyRecordUpdateAvailable().
 * Doing only one of these is the classic "I saved it but the page didn't
 * update" bug, so this module makes doing both a single call.
 */

/**
 * @param {string|string[]|Array<{recordId: string}>} recordIds
 * @returns {Array<{recordId: string}>}
 */
export function normalizeRecordIds(recordIds) {
    const list = Array.isArray(recordIds) ? recordIds : [recordIds];
    return list.filter(Boolean).map((entry) => (typeof entry === 'string' ? { recordId: entry } : entry));
}

/**
 * Tells other LDS-backed components on the page that these records changed.
 * @param {string|string[]|Array<{recordId: string}>} recordIds
 * @returns {Promise<void>}
 */
export function notifyRecordsChanged(recordIds) {
    const normalized = normalizeRecordIds(recordIds);
    if (!normalized.length) {
        return Promise.resolve();
    }
    return notifyRecordUpdateAvailable(normalized);
}

/**
 * Refreshes a wired Apex result and/or notifies LDS about changed records.
 * Pass whichever of the two apply; both are optional.
 * @param {object} [wiredResult] the object captured by a `@wire` property (not its `.data`)
 * @param {string|string[]|Array<{recordId: string}>} [recordIds]
 * @returns {Promise<void>}
 */
export function refreshRecords(wiredResult, recordIds) {
    const tasks = [];
    if (wiredResult) {
        tasks.push(refreshApex(wiredResult));
    }
    if (recordIds) {
        tasks.push(notifyRecordsChanged(recordIds));
    }
    return Promise.all(tasks).then(() => undefined);
}
