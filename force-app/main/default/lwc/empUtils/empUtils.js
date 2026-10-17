import { subscribe, unsubscribe } from 'lightning/empApi';

/**
 * Thin wrapper over lightning/empApi for the one thing most components want
 * from it: "tell me when records of this object change".
 *
 * It subscribes to the object's Change Data Capture channel, so Change Data
 * Capture must be switched on for that object (Setup > Integrations >
 * Change Data Capture). Without it the subscription fails and `subscribe`
 * rejects. Events only arrive while the page is open - nothing is replayed.
 *
 * @example
 * import { subscribeToObjectChanges } from 'c/empUtils';
 *
 * async connectedCallback() {
 *     this.stopWatching = await subscribeToObjectChanges('Account', (change) => {
 *         // change.changeType is 'CREATE' | 'UPDATE' | 'DELETE' | 'UNDELETE' | 'GAP_*'
 *         this.reload();
 *     });
 * }
 *
 * disconnectedCallback() {
 *     if (this.stopWatching) this.stopWatching();
 * }
 */

/**
 * The Change Data Capture channel for an object: Account -> /data/AccountChangeEvent,
 * Invoice__c -> /data/Invoice__ChangeEvent (custom objects swap the __c suffix).
 * @param {string} objectApiName
 * @returns {string}
 */
export function getChangeEventChannel(objectApiName) {
    const name = String(objectApiName || '').trim();
    if (!name) {
        throw new Error('An object API name is required to watch for changes.');
    }
    const eventName = name.endsWith('__c') ? `${name.slice(0, -3)}__ChangeEvent` : `${name}ChangeEvent`;
    return `/data/${eventName}`;
}

/**
 * Flattens the platform's change event envelope to the fields a UI needs.
 * @param {object} message the raw message delivered by empApi
 * @returns {{changeType: (string|undefined), entityName: (string|undefined), recordIds: string[], commitUser: (string|undefined), raw: object}}
 */
export function normalizeChangeEvent(message) {
    const header = message?.data?.payload?.ChangeEventHeader || {};
    return {
        changeType: header.changeType,
        entityName: header.entityName,
        recordIds: Array.isArray(header.recordIds) ? header.recordIds : [],
        commitUser: header.commitUser,
        raw: message
    };
}

/**
 * Calls `onChange` for every change to records of `objectApiName`, from now on.
 * Resolves once the subscription is in place, to a function that ends it.
 * @param {string} objectApiName
 * @param {(change: ReturnType<typeof normalizeChangeEvent>) => void} onChange
 * @returns {Promise<() => Promise<void>>}
 */
export async function subscribeToObjectChanges(objectApiName, onChange) {
    const channel = getChangeEventChannel(objectApiName);
    // -1 = only events from now on; replaying history would refresh for changes the user already has.
    const subscription = await subscribe(channel, -1, (message) => onChange(normalizeChangeEvent(message)));

    let ended = false;
    return () => {
        if (ended) {
            return Promise.resolve();
        }
        ended = true;
        return unsubscribe(subscription, () => {});
    };
}
