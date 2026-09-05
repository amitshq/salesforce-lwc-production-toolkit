import { NavigationMixin } from 'lightning/navigation';

/**
 * Thin wrappers around NavigationMixin's page-reference boilerplate.
 *
 * NavigationMixin can only be invoked on a LightningElement that has been
 * mixed in with it (`this[NavigationMixin.Navigate]` only exists on such an
 * instance) - a plain module cannot add that mixin to a caller's class for
 * it. So every function here takes the calling component (`this`) as its
 * first argument; the component must still `extends NavigationMixin(LightningElement)`.
 *
 * @example
 * import { NavigationMixin } from 'lightning/navigation';
 * import { navigateToRecord } from 'c/navigationUtils';
 * export default class MyComponent extends NavigationMixin(LightningElement) {
 *     openAccount(id) {
 *         navigateToRecord(this, id, 'Account');
 *     }
 * }
 */

export function navigateToRecord(component, recordId, objectApiName, actionName = 'view') {
    return component[NavigationMixin.Navigate]({
        type: 'standard__recordPage',
        attributes: { recordId, objectApiName, actionName }
    });
}

export function navigateToNewRecord(component, objectApiName, defaultFieldValues) {
    return component[NavigationMixin.Navigate]({
        type: 'standard__objectPage',
        attributes: { objectApiName, actionName: 'new' },
        state: defaultFieldValues ? { defaultFieldValues: toDefaultFieldValuesParam(defaultFieldValues) } : undefined
    });
}

export function navigateToObjectHome(component, objectApiName) {
    return component[NavigationMixin.Navigate]({
        type: 'standard__objectPage',
        attributes: { objectApiName, actionName: 'home' }
    });
}

export function navigateToListView(component, objectApiName, listViewApiName) {
    return component[NavigationMixin.Navigate]({
        type: 'standard__objectPage',
        attributes: { objectApiName, actionName: 'list' },
        state: listViewApiName ? { filterName: listViewApiName } : undefined
    });
}

export function navigateToRelatedList(component, recordId, objectApiName, relationshipApiName) {
    return component[NavigationMixin.Navigate]({
        type: 'standard__recordRelationshipPage',
        attributes: { recordId, objectApiName, relationshipApiName, actionName: 'view' }
    });
}

export function navigateToTab(component, apiName) {
    return component[NavigationMixin.Navigate]({
        type: 'standard__navItemPage',
        attributes: { apiName }
    });
}

export function navigateToWebPage(component, url) {
    return component[NavigationMixin.Navigate]({
        type: 'standard__webPage',
        attributes: { url }
    });
}

/**
 * Resolves a record page's href without navigating - for building an
 * anchor tag inside a custom row template (e.g. a datatable cell).
 * @returns {Promise<string>}
 */
export function generateRecordUrl(component, recordId, objectApiName, actionName = 'view') {
    return component[NavigationMixin.GenerateUrl]({
        type: 'standard__recordPage',
        attributes: { recordId, objectApiName, actionName }
    });
}

function toDefaultFieldValuesParam(defaultFieldValues) {
    return Object.keys(defaultFieldValues)
        .map((key) => `${key}=${encodeURIComponent(defaultFieldValues[key])}`)
        .join(',');
}
