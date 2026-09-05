# Usage Guide

Point-to-point reference for every component, utility module, and Apex service in this repo: what it is, how to import it, and its full public API.

For the "why," see [README.md](README.md). This document only covers "how."

## Table of contents

- [Requirements](#requirements)
- [Deploying this repo](#deploying-this-repo)
- [Enterprise Datatable](#enterprise-datatable)
- [UX components](#ux-components)
  - [Modal](#modal)
  - [Confirm Dialog](#confirm-dialog)
  - [State Manager](#state-manager)
  - [Empty State](#empty-state)
  - [Error State](#error-state)
  - [Wizard](#wizard)
  - [Bulk Action Bar](#bulk-action-bar)
  - [Infinite Scroll Loader](#infinite-scroll-loader)
- [Data utility modules](#data-utility-modules)
  - [functionUtils](#functionutils)
  - [objectUtils](#objectutils)
  - [jsonUtils](#jsonutils)
  - [urlUtils](#urlutils)
- [Salesforce utility modules](#salesforce-utility-modules)
  - [apexErrorUtils](#apexerrorutils)
  - [ldsErrorUtils](#ldserrorutils)
  - [navigationUtils](#navigationutils)
  - [recordUtils](#recordutils)
  - [permissionUtils](#permissionutils)
  - [metadataUtils](#metadatautils)
  - [toastService](#toastservice)
- [Apex services](#apex-services)
  - [GenericQueryService](#genericqueryservice)
  - [GenericDmlService](#genericdmlservice)
  - [PermissionService](#permissionservice-apex)
  - [CustomMetadataService](#custommetadataservice-apex)
- [Running the tests](#running-the-tests)

---

## Requirements

- Salesforce CLI (`sf`), authenticated to a Dev Hub, sandbox, or scratch org
- API 61.0+ org (Summer '24+)
- Node.js 18+ (only needed to run Jest/ESLint locally, not to deploy)

## Deploying this repo

1. Create or target an org:
   ```bash
   sf org create scratch -f config/project-scratch-def.json -a lwc-toolkit -d 7
   ```
2. Deploy all metadata:
   ```bash
   sf project deploy start -o lwc-toolkit
   ```
3. Assign the permission set (grants Apex class access, the `Toolkit_Bulk_Edit` custom permission, and FLS on the demo custom metadata fields):
   ```bash
   sf org assign permset -o lwc-toolkit -n LWCToolkitAdmin
   ```
4. Open the org and add **Enterprise Datatable Demo (Accounts)** to any App Page, Record Page, or Home Page via Lightning App Builder:
   ```bash
   sf org open -o lwc-toolkit
   ```

To use any single component/utility in your own project instead of the whole repo, copy that component's folder from `force-app/main/default/lwc/` (and, for `enterpriseDatatable`, the four Apex classes under [Apex services](#apex-services) plus their `*.cls-meta.xml` files) into your own `force-app`.

---

## Enterprise Datatable

`c-enterprise-datatable` &mdash; the flagship component. Generic, server-side datatable: paging, sorting, filtering, search, inline edit with bulk save, optional bulk delete, and partial-error reporting, for any object.

### Basic usage

```html
<c-enterprise-datatable
    object-api-name="Account"
    title="Accounts"
    columns={columns}
    page-size="25"
    pagination-mode="pages"
    search-fields={searchFields}
    bulk-actions={bulkActions}
    enable-row-selection
    enable-bulk-delete
    default-sort-field="Name"
    default-sort-direction="asc"
    onbulkaction={handleBulkAction}
></c-enterprise-datatable>
```

```js
columns = [
    { label: 'Name', fieldName: 'Name', type: 'text', editable: true, filterable: true },
    { label: 'Industry', fieldName: 'Industry', type: 'text', editable: true, filterable: true, filterOperator: 'LIKE' },
    { label: 'Owner', fieldName: 'Owner.Name', type: 'text' } // relationship fields are auto-flattened
];
searchFields = ['Name', 'Industry'];
bulkActions = [{ name: 'export', label: 'Export CSV', iconName: 'utility:download' }];

handleBulkAction(event) {
    const { name, selectedRows } = event.detail;
    // name === 'export' here; handle your own action
}
```

Columns use the standard `lightning-datatable` column shape, with two additions: `filterable` and `filterOperator`.

### `@api` properties

| Property | Type | Default | Description |
|---|---|---|---|
| `objectApiName` | String | — (required) | The sObject to query, e.g. `'Account'`. |
| `title` | String | `''` | Card header title. |
| `keyField` | String | `'Id'` | Row key field, passed to `lightning-datatable`. |
| `columns` | Array | `[]` | Column definitions (see above). |
| `pageSize` | Number | `25` | Rows per page/batch. |
| `paginationMode` | String | `'pages'` | `'pages'` (Previous/Next) or `'infinite'` (scroll-triggered). |
| `searchFields` | Array&lt;String&gt; | `[]` | Fields the global search box searches (`LIKE`, OR'd together). Omit to hide the search box. |
| `searchPlaceholder` | String | `'Search...'` | Search input placeholder. |
| `staticFilters` | Array | `[]` | Always-applied filters: `[{ fieldName, operatorName, value }]`. Use this to scope the table, e.g. to a parent record's Id. |
| `defaultSortField` | String | — | Initial `sortedBy` field. |
| `defaultSortDirection` | String | `'asc'` | Initial `sortedDirection`. |
| `enableRowSelection` | Boolean | `false` | Shows the checkbox column and enables the bulk action bar. |
| `bulkActions` | Array | `[]` | `[{ name, label, variant, iconName, disabled }]` — re-emitted via the `bulkaction` event. |
| `enableBulkDelete` | Boolean | `false` | Adds a built-in "Delete" bulk action, gated on the object's `isDeletable` access and a confirmation dialog. |
| `hideRefreshButton` | Boolean | `false` | Hides the header refresh button. |

### Events

| Event | `detail` | When |
|---|---|---|
| `bulkaction` | `{ name, selectedRows }` | A `bulkActions` entry (not the built-in delete) was clicked. |

### Methods

| Method | Returns | Description |
|---|---|---|
| `refresh()` | `Promise<void>` | Re-runs the current query. Infinite mode resets to page 1; page mode re-fetches the current page. Clears selection and any in-progress edits. |

### Filtering

Any column with `filterable: true` gets a quick-filter text input above the table. `filterOperator` (default `'='`) sets the SOQL operator used server-side: `'='`, `'!='`, `'<'`, `'<='`, `'>'`, `'>='`, `'LIKE'`, `'IN'`, `'NOT IN'`. Use `'LIKE'` for free-text search on a Text field; do not use `'LIKE'` on Number/Date/Boolean fields (SOQL will reject it).

### Inline editing and partial errors

Set `editable: true` on a column to enable inline editing (native `lightning-datatable` behavior). On save, all edited rows are sent to `GenericDmlService.saveRecords` in one batch:

- Rows that save successfully are merged into the table and cleared from the draft state.
- Rows that fail stay in edit mode with the server's error message shown against that row (via `lightning-datatable`'s `errors` prop) — a batch of 20 edits where 2 fail does not lose your other 18 edits.
- A summary toast reports the success/failure counts.

### Bulk delete

Set `enable-bulk-delete`. The delete action only appears if `PermissionService.checkObjectAccess` reports the object as deletable for the running user. Clicking it opens `c-confirm-dialog`; on confirmation, selected rows are sent to `GenericDmlService.deleteRecords`, which also reports partial failures.

---

## UX components

### Modal

`c-modal` &mdash; declarative, slot-based modal for content authored inline in a parent's template (a form, a multi-section panel). Works anywhere a component can be placed, including Experience Cloud/LWR pages.

```html
<c-modal header-label="Edit Contact" onclose={handleClose}>
    <div class="slds-p-around_medium">... body ...</div>
    <div slot="footer">
        <lightning-button label="Cancel" onclick={handleCancel}></lightning-button>
        <lightning-button label="Save" variant="brand" onclick={handleSave}></lightning-button>
    </div>
</c-modal>
```

```js
// In the parent, imperatively:
this.template.querySelector('c-modal').open();
```

**`@api` properties**

| Property | Type | Default | Description |
|---|---|---|---|
| `headerLabel` | String | `''` | Modal header text. |
| `size` | String | `'medium'` | `'small'`, `'medium'`, `'large'`, or `'full'`. |
| `preventCloseOnBackdropClick` | Boolean | `false` | Set `true` to disable closing on backdrop click. |
| `hideCloseButton` | Boolean | `false` | Hides the header "X" button. |

**Methods**: `open()`, `close()`. **Events**: `close` (no detail).

Keyboard: Escape closes the modal (unless disabled); Tab/Shift+Tab are trapped within the modal while open; focus returns to the triggering element on close.

### Confirm Dialog

`c-confirm-dialog` &mdash; promise-based confirmation, built on the platform's `lightning/modal` service.

```js
import ConfirmDialog from 'c/confirmDialog';

async handleDelete() {
    const confirmed = await ConfirmDialog.open({
        label: 'Delete Records',
        message: 'This will permanently delete 3 records. This cannot be undone.',
        variant: 'destructive',
        confirmLabel: 'Delete'
    });
    if (confirmed) {
        // proceed
    }
}
```

**`open()` options**

| Property | Type | Default | Description |
|---|---|---|---|
| `label` | String | `'Confirm'` | Dialog header. |
| `message` | String | `'Are you sure?'` | Body text. |
| `variant` | String | `'neutral'` | `'neutral'` or `'destructive'` (controls the confirm button's color). |
| `confirmLabel` | String | `'Confirm'` | Confirm button label. |
| `cancelLabel` | String | `'Cancel'` | Cancel button label. |

`open()` resolves `true` (confirmed) or `false` (canceled/dismissed).

### State Manager

`c-state-manager` &mdash; the loading/error/empty/content branch, so you don't write it by hand in every component. Exactly one state renders at a time, in this priority: loading &gt; error &gt; empty &gt; content.

```html
<c-state-manager is-loading={isLoading} has-error={hasError} error-message={errorMessage} is-empty={isEmpty} empty-title="No records found">
    <template for:each={rows} for:item="row">...</template>
</c-state-manager>
```

**`@api` properties**

| Property | Type | Default | Description |
|---|---|---|---|
| `isLoading` | Boolean | `false` | Shows the loading slot/spinner. |
| `hasError` | Boolean | `false` | Shows the error slot. |
| `errorMessage` | String | `''` | Passed through to the default `c-error-state`. |
| `isEmpty` | Boolean | `false` | Shows the empty slot. |
| `loadingLabel` | String | `'Loading...'` | Spinner's accessible label. |
| `emptyTitle` | String | `'Nothing to show'` | Passed through to the default `c-empty-state`. |
| `emptyMessage` | String | `''` | Passed through to the default `c-empty-state`. |
| `emptyIconName` | String | `'utility:open_folder'` | Passed through to the default `c-empty-state`. |

**Slots**: `loading`, `error`, `empty` (each has a default implementation you can override), and the unnamed default slot for content.

### Empty State

`c-empty-state` &mdash; presentational "no data" placeholder, usable standalone or via `c-state-manager`'s default empty slot.

```html
<c-empty-state title="No accounts yet" message="Create your first account to get started." icon-name="utility:add">
    <lightning-button slot="actions" label="New Account" variant="brand"></lightning-button>
</c-empty-state>
```

| Property | Type | Default |
|---|---|---|
| `title` | String | `'Nothing to show'` |
| `message` | String | `''` |
| `iconName` | String | `'utility:open_folder'` |

Slot: `actions`.

### Error State

`c-error-state` &mdash; presentational error placeholder with a retry button and optional collapsible raw-error details, usable standalone or via `c-state-manager`.

```html
<c-error-state message={errorMessage} details={rawErrorJson} onretry={handleRetry}></c-error-state>
```

| Property | Type | Default | Description |
|---|---|---|---|
| `title` | String | `'Something went wrong'` | |
| `message` | String | `''` | |
| `hideRetry` | Boolean | `false` | Hides the retry button. |
| `retryLabel` | String | `'Try Again'` | |
| `details` | String | `''` | Raw error text (e.g. the output of `reduceApexErrors`); shown behind a "Show details" toggle when non-empty. |

**Events**: `retry` (no detail) — dispatched when the retry button is clicked.

### Wizard

`c-wizard` &mdash; multi-step flow. A `lightning-progress-indicator` for the visual stepper, plus a single default slot whose direct children the wizard shows/hides by step (matched via each child's `data-step` attribute).

```html
<c-wizard steps={steps} onbeforestepchange={handleBeforeStepChange} onfinish={handleFinish}>
    <div data-step="details">... step 1 fields ...</div>
    <div data-step="review">... step 2 summary ...</div>
</c-wizard>
```

```js
steps = [
    { label: 'Details', value: 'details' },
    { label: 'Review', value: 'review' }
];

handleBeforeStepChange(event) {
    if (!this.isStep1Valid) {
        event.preventDefault(); // blocks the transition
    }
}
```

**`@api` properties**

| Property | Type | Default | Description |
|---|---|---|---|
| `steps` | Array | `[]` | `[{ label, value }]`. |
| `indicatorType` | String | `'path'` | `'path'` or `'base'` (passed to `lightning-progress-indicator`). |
| `hideIndicator` | Boolean | `false` | Hides the progress indicator. |
| `hideNavigation` | Boolean | `false` | Hides the built-in Back/Next/Finish buttons. |
| `backLabel` / `nextLabel` / `finishLabel` | String | `'Back'` / `'Next'` / `'Finish'` | Button labels. |

**Methods**

| Method | Returns | Description |
|---|---|---|
| `next()` | Boolean | Advances one step; `false` if already on the last step or canceled. |
| `back()` | Boolean | Goes back one step; `false` if already on the first step. |
| `goToStep(value)` | Boolean | Jumps to the step with this `value`; `false` if not found or canceled. |
| `activeStep` (getter) | `{ label, value }` | The current step. |

**Events**

| Event | `detail` | Cancelable | When |
|---|---|---|---|
| `beforestepchange` | `{ fromValue, toValue }` | Yes | Before any step transition. Call `event.preventDefault()` to block it (e.g. failed validation). |
| `stepchange` | `{ value, index }` | No | After a step transition completes. |
| `finish` | `{ value }` | No | The Finish button was clicked on the last step. |

### Bulk Action Bar

`c-bulk-action-bar` &mdash; "N selected" toolbar for any multi-select list, independent of the datatable.

```html
<c-bulk-action-bar
    selected-count={selectedRows.length}
    actions={bulkActions}
    onaction={handleBulkAction}
    onclear={handleClearSelection}
></c-bulk-action-bar>
```

| Property | Type | Default | Description |
|---|---|---|---|
| `selectedCount` | Number | `0` | Renders nothing when `0`. |
| `actions` | Array | `[]` | `[{ name, label, variant, iconName, disabled }]`. |
| `clearLabel` | String | `'Clear selection'` | |

**Events**: `action` (`{ name, selectedCount }`), `clear` (no detail).

### Infinite Scroll Loader

`c-infinite-scroll-loader` &mdash; IntersectionObserver-based "load more" sentinel, reusable for any list or grid.

```html
<template for:each={rows} for:item="row">...</template>
<c-infinite-scroll-loader is-loading={isLoadingMore} disabled={allRowsLoaded} onloadmore={handleLoadMore}></c-infinite-scroll-loader>
```

| Property | Type | Default | Description |
|---|---|---|---|
| `isLoading` | Boolean | `false` | Shows a small spinner; suppresses further `loadmore` events while `true`. |
| `disabled` | Boolean | `false` | Set `true` once there is nothing left to load. |
| `rootMargin` | String | `'100px'` | IntersectionObserver root margin — how far before the sentinel is visible to trigger. |

**Events**: `loadmore` (no detail).

---

## Data utility modules

### functionUtils

```js
import { debounce, throttle } from 'c/functionUtils';
```

| Function | Signature | Description |
|---|---|---|
| `debounce` | `(fn, waitMs = 300) => Function` | Delays calling `fn` until `waitMs` have passed with no further calls. Returned function has a `.cancel()` method. |
| `throttle` | `(fn, waitMs = 300) => Function` | Calls `fn` at most once per `waitMs`: immediately on the leading edge, and once more on the trailing edge if calls arrived mid-window. Returned function has a `.cancel()` method. |

### objectUtils

```js
import { deepClone, isEqual, getNestedValue, setNestedValue } from 'c/objectUtils';
```

| Function | Signature | Description |
|---|---|---|
| `deepClone` | `(value) => value` | Recursively clones objects/arrays/Date/Map/Set. Functions and non-plain class instances are copied by reference. |
| `isEqual` | `(a, b) => Boolean` | Deep equality for objects, arrays, Dates, and primitives. |
| `getNestedValue` | `(obj, path, defaultValue?) => any` | Reads a dot/bracket path (`'a.b[0].c'`), returning `defaultValue` instead of throwing on a missing segment. |
| `setNestedValue` | `(obj, path, value) => newObj` | Returns a new object with `value` set at `path`, without mutating the original; creates missing intermediate objects/arrays as needed. |

### jsonUtils

```js
import { safeParse, safeStringify, prettyPrint, isValidJson } from 'c/jsonUtils';
```

| Function | Signature | Description |
|---|---|---|
| `safeParse` | `(jsonString, fallback = null) => any` | `JSON.parse` that returns `fallback` instead of throwing. |
| `safeStringify` | `(value, fallback = '', indent?) => String` | `JSON.stringify` that returns `fallback` instead of throwing (e.g. on circular structures). |
| `prettyPrint` | `(value, indent = 2) => String` | Accepts a JSON string or a JS value; returns indented JSON, or the original string if it isn't valid JSON. |
| `isValidJson` | `(value) => Boolean` | |

### urlUtils

```js
import { parseQueryParams, buildQueryString, getQueryParam, withQueryParam, removeQueryParam } from 'c/urlUtils';
```

| Function | Signature | Description |
|---|---|---|
| `parseQueryParams` | `(search = window.location.search) => Object` | Repeated keys become arrays. |
| `buildQueryString` | `(params) => String` | Returns `'?a=1&b=2'` or `''`; `null`/`undefined` values are omitted; array values repeat the key. |
| `getQueryParam` | `(name, search = window.location.search) => String|null` | |
| `withQueryParam` | `(url, name, value) => String` | Returns a new URL string with `name` set, preserving the rest of the URL. |
| `removeQueryParam` | `(url, name) => String` | Returns a new URL string with `name` removed. |

---

## Salesforce utility modules

### apexErrorUtils

For errors from an **imperative `@salesforce/apex` call**, or a `@wire` to an Apex method.

```js
import { reduceApexErrors, reduceApexErrorMessage } from 'c/apexErrorUtils';

try {
    await saveRecords({ objectApiName, records });
} catch (error) {
    const messages = reduceApexErrors(error); // string[]
    // or: const message = reduceApexErrorMessage(error, ', ');
}
```

| Function | Signature | Description |
|---|---|---|
| `reduceApexErrors` | `(errors) => String[]` | Handles a single error or an array of errors; extracts page errors, field errors, and plain exception messages. Falls back to `['Unknown error']`. |
| `reduceApexErrorMessage` | `(errors, separator = ', ') => String` | `reduceApexErrors(...).join(separator)`. |

### ldsErrorUtils

For errors from **Lightning Data Service / UI API** (`getRecord`, `createRecord`, `updateRecord`, `deleteRecord`, `lightning-record-edit-form`). Same shape as `apexErrorUtils`, different error structure (`error.body.output.errors` / `.fieldErrors` instead of `error.body.pageErrors`).

```js
import { reduceLdsErrors, reduceLdsErrorMessage } from 'c/ldsErrorUtils';
```

| Function | Signature |
|---|---|
| `reduceLdsErrors` | `(errors) => String[]` |
| `reduceLdsErrorMessage` | `(errors, separator = ', ') => String` |

### navigationUtils

Wraps `NavigationMixin` boilerplate. Every function takes the calling component (`this`) as its first argument — the component must still `extends NavigationMixin(LightningElement)`.

```js
import { NavigationMixin } from 'lightning/navigation';
import { navigateToRecord } from 'c/navigationUtils';

export default class MyComponent extends NavigationMixin(LightningElement) {
    openAccount(id) {
        navigateToRecord(this, id, 'Account');
    }
}
```

| Function | Signature |
|---|---|
| `navigateToRecord` | `(component, recordId, objectApiName, actionName = 'view')` |
| `navigateToNewRecord` | `(component, objectApiName, defaultFieldValues?)` |
| `navigateToObjectHome` | `(component, objectApiName)` |
| `navigateToListView` | `(component, objectApiName, listViewApiName)` |
| `navigateToRelatedList` | `(component, recordId, objectApiName, relationshipApiName)` |
| `navigateToTab` | `(component, apiName)` |
| `navigateToWebPage` | `(component, url)` |
| `generateRecordUrl` | `(component, recordId, objectApiName, actionName = 'view') => Promise<String>` — resolves the href without navigating. |

### recordUtils

Pairs `refreshApex` (for your own `@wire`'d Apex results) with `notifyRecordUpdateAvailable` (to tell every *other* LDS-backed component on the page a record changed) in one call — the two things that both need to happen after a DML that bypassed LDS (an imperative Apex save, a Platform Event).

```js
import { refreshRecords, notifyRecordsChanged, normalizeRecordIds } from 'c/recordUtils';

// After an imperative Apex save:
await refreshRecords(this.wiredAccounts, savedRecordIds);
```

| Function | Signature | Description |
|---|---|---|
| `refreshRecords` | `(wiredResult?, recordIds?) => Promise<void>` | Runs `refreshApex(wiredResult)` and/or `notifyRecordsChanged(recordIds)` — whichever arguments you pass. |
| `notifyRecordsChanged` | `(recordIds) => Promise<void>` | `recordIds` can be a single Id, an array of Ids, or an array already shaped as `{ recordId }`. |
| `normalizeRecordIds` | `(recordIds) => Array<{recordId}>` | The shape-normalizing helper used internally; exported for direct use. |

### permissionUtils

Client wrapper over `PermissionService.cls`, memoized per session (a user's permissions don't change mid-session) so repeated checks don't refire the same Apex call.

```js
import { getObjectAccess, getFieldAccess, hasCustomPermission } from 'c/permissionUtils';

const access = await getObjectAccess('Account'); // { isAccessible, isCreateable, isUpdateable, isDeletable }
const fields = await getFieldAccess('Account', ['Name', 'Industry']); // [{ fieldName, readable, editable }]
const canBulkEdit = await hasCustomPermission('Toolkit_Bulk_Edit');
```

| Function | Signature |
|---|---|
| `getObjectAccess` | `(objectApiName) => Promise<{isAccessible, isCreateable, isUpdateable, isDeletable}>` |
| `getFieldAccess` | `(objectApiName, fieldNames) => Promise<Array<{fieldName, readable, editable}>>` |
| `hasCustomPermission` | `(developerName) => Promise<Boolean>` |
| `clearPermissionCache` | `() => void` — clears every cached result. |

### metadataUtils

Client wrapper over `CustomMetadataService.cls`, cached by (type, fields) for the session.

```js
import { getMetadataRecords, getMetadataRecordByDeveloperName } from 'c/metadataUtils';

const records = await getMetadataRecords('ToolkitDemoSetting__mdt', ['IsEnabled__c']);
const record = await getMetadataRecordByDeveloperName('ToolkitDemoSetting__mdt', 'Default', ['DefaultPageSize__c']);
```

| Function | Signature |
|---|---|
| `getMetadataRecords` | `(metadataApiName, fieldNames = []) => Promise<Array<Object>>` |
| `getMetadataRecordByDeveloperName` | `(metadataApiName, developerName, fieldNames = []) => Promise<Object|null>` |
| `clearMetadataCache` | `() => void` |

### toastService

Consistent `ShowToastEvent` dispatch, with de-duplication (a toast is suppressed if an identical one was shown in the last 3 seconds — common when both a `@wire`'s error path and a `try/catch` fire for the same failure). Every function takes the calling component as its first argument.

```js
import { showToast, showSuccessToast, showErrorToast } from 'c/toastService';

showSuccessToast(this, 'Record saved.');
showErrorToast(this, reduceApexErrors(error));
```

| Function | Signature |
|---|---|
| `showToast` | `(component, { title, message, variant = 'info', mode = 'dismissable', messageData, allowDuplicate = false })` |
| `showSuccessToast` | `(component, message, title = 'Success')` |
| `showInfoToast` | `(component, message, title = 'Info')` |
| `showWarningToast` | `(component, message, title = 'Warning')` |
| `showErrorToast` | `(component, messageOrMessages, title = 'Error')` — accepts a string or a `string[]` (e.g. from `reduceApexErrors`); uses `mode: 'sticky'`. |
| `clearToastDedupeState` | `() => void` |

---

## Apex services

### GenericQueryService

```apex
@AuraEnabled(cacheable=true)
public static QueryResult query(
    String objectApiName, List<String> fields, List<QueryFilter> filters,
    String sortField, String sortDirection, String searchTerm, List<String> searchFields,
    Integer pageNumber, Integer pageSize
)
```

- Returns a `QueryResult`: `{ records, totalCount, pageNumber, pageSize, hasMore }`.
- `filters`: list of `QueryFilter { fieldName, operatorName, value }`. Supported operators: `=`, `!=`, `<`, `<=`, `>`, `>=`, `LIKE`, `IN`, `NOT IN`.
- Unknown/inaccessible fields are silently dropped (not an error); an unknown object throws.
- Field/object identifiers are validated against schema describes; values are bound via `Database.queryWithBinds` — never string-concatenated.
- Relationship paths (`'Owner.Name'`) are supported and validated hop-by-hop.

### GenericDmlService

```apex
@AuraEnabled
public static List<DmlResult> saveRecords(String objectApiName, List<DmlRecordInput> records)

@AuraEnabled
public static List<DmlResult> deleteRecords(String objectApiName, List<String> recordIds)
```

- `DmlRecordInput`: `{ rowKey, fields }` — `fields` is a map of field API name to value; include `Id` to update, omit it to insert.
- `DmlResult`: `{ rowKey, recordId, success, message, fieldNames }` — one per input row, correlated by `rowKey`.
- Runs with `allOrNone=false`: one bad row never blocks the rest of the batch.
- FLS enforced via `Security.stripInaccessible` before every insert/update.

### PermissionService (Apex)

```apex
@AuraEnabled(cacheable=true)
public static Map<String, Boolean> checkObjectAccess(String objectApiName)
// => { isAccessible, isCreateable, isUpdateable, isDeletable }

@AuraEnabled(cacheable=true)
public static List<FieldAccess> checkFieldAccess(String objectApiName, List<String> fieldNames)
// => [{ fieldName, readable, editable }]

@AuraEnabled(cacheable=true)
public static Boolean hasCustomPermission(String developerName)
```

`hasCustomPermission` checks both explicit Permission Set/Permission Set Group assignments and permissions granted directly on the user's Profile.

### CustomMetadataService (Apex)

```apex
@AuraEnabled(cacheable=true)
public static List<SObject> getRecords(String metadataApiName, List<String> fieldNames)

@AuraEnabled(cacheable=true)
public static SObject getRecordByDeveloperName(String metadataApiName, String developerName, List<String> fieldNames)
```

`metadataApiName` must end in `__mdt`; anything else throws. `Id`, `DeveloperName`, and `MasterLabel` are always included; `fieldNames` adds any further fields you request (silently dropped if unknown/inaccessible).

---

## Running the tests

```bash
npm install
npm test             # Jest — 125 tests across every LWC/util module
npm run lint          # ESLint
```

Apex tests (`*Test.cls`, 22 methods) run in your org:

```bash
sf apex run test -o lwc-toolkit -c -r human
```
