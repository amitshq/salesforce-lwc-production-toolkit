# Usage Guide

Point-to-point reference for every component, utility module, and Apex service in this repo: what it is, how to import it, and its full public API.

For the "why," see [README.md](README.md). This document only covers "how."

## Table of contents

- [Requirements](#requirements)
- [Deploying this repo](#deploying-this-repo)
- [Enterprise Datatable](#enterprise-datatable)
- [Other data components](#other-data-components)
  - [Multi-Select Lookup](#multi-select-lookup)
  - [Dynamic Filter Panel](#dynamic-filter-panel)
  - [Dynamic Form](#dynamic-form)
  - [Pagination](#pagination)
  - [File Upload Manager](#file-upload-manager)
  - [Image Gallery](#image-gallery)
- [UX components](#ux-components)
  - [Modal](#modal)
  - [Confirm Dialog](#confirm-dialog)
  - [State Manager](#state-manager)
  - [Empty State](#empty-state)
  - [Error State](#error-state)
  - [Wizard](#wizard)
  - [Bulk Action Bar](#bulk-action-bar)
  - [Infinite Scroll Loader](#infinite-scroll-loader)
  - [Permission Gate](#permission-gate)
  - [Feature Gate](#feature-gate)
  - [KPI Card](#kpi-card)
  - [Date Range Picker](#date-range-picker)
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
  - [lmsUtils](#lmsutils)
- [Apex services](#apex-services)
  - [GenericQueryService](#genericqueryservice)
  - [GenericDmlService](#genericdmlservice)
  - [PermissionService](#permissionservice-apex)
  - [CustomMetadataService](#custommetadataservice-apex)
  - [FileManagerService](#filemanagerservice-apex)
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

## Other data components

### Multi-Select Lookup

`c-multi-select-lookup` &mdash; type-to-search against any object (via `GenericQueryService` &mdash; no bespoke Apex controller), pick multiple records, remove them individually. Selected records render as pills.

```html
<c-multi-select-lookup
    label="Contacts"
    object-api-name="Contact"
    label-field="Name"
    search-fields={searchFields}
    selected-records={selectedContacts}
    onchange={handleContactsChange}
></c-multi-select-lookup>
```

```js
searchFields = ['Name', 'Email'];
handleContactsChange(event) {
    this.selectedContacts = event.detail.value; // [{ id, label }]
}
```

| Property | Type | Default | Description |
|---|---|---|---|
| `objectApiName` | String | — (required) | Object to search. |
| `labelField` | String | `'Name'` | Field shown for each result and used as the default search field. |
| `searchFields` | Array&lt;String&gt; | `[labelField]` | Fields searched (`LIKE`, OR'd). |
| `staticFilters` | Array | `[]` | Always-applied `QueryFilter`s, same shape as `enterpriseDatatable`. |
| `selectedRecords` | Array | `[]` | `[{ id, label }]`. Settable to pre-populate. |
| `minSearchLength` | Number | `2` | Characters typed before a search fires. |
| `pageSize` | Number | `10` | Max results shown per keystroke. |

**Events**: `change` (`{ value: [{ id, label }] }`) — fired on every add/remove.

Keyboard: Arrow Up/Down move the highlight, Enter selects, Escape closes the dropdown.

### Dynamic Filter Panel

`c-dynamic-filter-panel` &mdash; builds a list of filter conditions and emits them in exactly the `QueryFilter` shape `GenericQueryService.query()` expects, so it drops straight into `enterpriseDatatable`'s `static-filters` or a direct Apex call.

```html
<c-dynamic-filter-panel fields={filterableFields} onchange={handleFiltersChange}></c-dynamic-filter-panel>
```

```js
filterableFields = [
    { label: 'Industry', value: 'Industry', type: 'text' },
    { label: 'Annual Revenue', value: 'AnnualRevenue', type: 'currency' },
    { label: 'Active', value: 'IsActive__c', type: 'boolean' }
];
handleFiltersChange(event) {
    this.filters = event.detail.value; // [{ fieldName, operatorName, value }]
}
```

| Property | Type | Default | Description |
|---|---|---|---|
| `fields` | Array | `[]` | `[{ label, value, type }]`. `type` is one of `text`, `number`, `currency`, `date`, `boolean`, `picklist` — it controls which operators and which input control are offered. |
| `addLabel` | String | `'Add filter'` | Label on the "add a condition" button. |

**Methods**: `addCondition()`, `clearAll()`, `value` (getter, current `QueryFilter[]`).

**Events**: `change` (`{ value }`) — fired whenever a row is added, edited, or removed. Incomplete rows (no value entered yet) are excluded from `value`. `IN`/`NOT IN` operators split a comma-separated value into an array automatically.

### Dynamic Form

`c-dynamic-form` &mdash; renders a form from a plain field-config array instead of a fixed markup template. Pairs naturally with `GenericDmlService.saveRecords`: listen for `submit` and pass `event.detail.values` straight through as one row's `fields`.

```html
<c-dynamic-form fields={fields} object-api-name="Contact" onsubmit={handleSubmit}></c-dynamic-form>
```

```js
fields = [
    { apiName: 'LastName', label: 'Last Name', type: 'text', required: true },
    { apiName: 'Email', label: 'Email', type: 'email' },
    { apiName: 'Status__c', label: 'Status', type: 'picklist', options: [{ label: 'Active', value: 'Active' }] }
];
```

| Property | Type | Default | Description |
|---|---|---|---|
| `fields` | Array | `[]` | `[{ apiName, label, type, required?, options?, defaultValue?, helpText? }]`. `type` is one of `text`, `email`, `phone`, `number`, `date`, `datetime`, `url`, `textarea`, `checkbox`/`boolean`, `picklist`/`select`. |
| `objectApiName` | String | — | Optional. When set, each field's edit access is checked via `permissionUtils.getFieldAccess` and read-only fields are disabled &mdash; the server (`Security.stripInaccessible`) still enforces this regardless. |
| `values` | Object | `{}` | Settable to pre-fill the form (edit mode). |
| `submitLabel` / `cancelLabel` | String | `'Save'` / `'Cancel'` | Button labels. |
| `hideCancelButton` / `hideSubmitButton` | Boolean | `false` | Hide either built-in button (e.g. to drive submission from your own toolbar). |

**Methods**: `getValues()` (current values map), `reportValidity()` (runs each field's native validation, returns `Boolean`), `reset()`.

**Events**: `submit` (`{ values }`) — only dispatched once `reportValidity()` passes. `cancel` (no detail).

### Pagination

`c-pagination` &mdash; standalone Previous/Next + numbered-page control. `enterpriseDatatable` has its own built-in pagination bar; this is for everything else (a related-list clone, a report viewer) that needs the same control on its own. Fully controlled: it renders from props and only ever asks for a change via events.

```html
<c-pagination
    current-page={currentPage}
    total-records={totalRecords}
    page-size={pageSize}
    onpagechange={handlePageChange}
></c-pagination>
```

| Property | Type | Default | Description |
|---|---|---|---|
| `currentPage` | Number | `1` | |
| `totalRecords` | Number | `0` | |
| `pageSize` | Number | `25` | |
| `maxPageButtons` | Number | `5` | How many numbered page buttons to show, windowed around the current page. |

**Events**: `pagechange` (`{ page }`).

For very large or fast-growing tables where OFFSET pagination gets slow at high page numbers, pair this with `GenericQueryService.queryWithCursor` (see [Apex services](#genericqueryservice)) instead of `query` &mdash; keyset pagination has no page-number concept, so drive it with a "Load more" affordance (e.g. `c-infinite-scroll-loader`) rather than `c-pagination`'s numbered buttons.

### File Upload Manager

`c-file-upload-manager` &mdash; upload (via the platform's own `lightning-file-upload`), list what's already attached to a record, and delete &mdash; instead of re-wiring `ContentDocumentLink` queries per project.

```html
<c-file-upload-manager record-id={recordId} accepted-formats={acceptedFormats}></c-file-upload-manager>
```

| Property | Type | Default | Description |
|---|---|---|---|
| `recordId` | String | — (required) | Record files are attached to/listed for. |
| `label` | String | `'Files'` | Card title. |
| `acceptedFormats` | Array&lt;String&gt; | `['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.xlsx', '.csv', '.txt']` | Passed to `lightning-file-upload`'s `accept`. |
| `singleFileOnly` | Boolean | `false` | Restrict to one file per upload. |
| `hideUploadArea` | Boolean | `false` | Show only the file list (e.g. a read-only view). |

**Methods**: `refresh()`.

Backed by `FileManagerService.cls` (see [Apex services](#filemanagerservice-apex)) for listing/deleting; uploading itself is handled entirely by the base `lightning-file-upload` component.

### Image Gallery

`c-image-gallery` &mdash; thumbnail grid with a click-to-enlarge lightbox (built on `c-modal`, with Previous/Next navigation and Left/Right arrow-key support).

```html
<c-image-gallery images={images}></c-image-gallery>
```

```js
images = [{ url: '/path/to/img.jpg', title: 'Site photo 1' }, ...];
```

Pair it with `FileManagerService.getFilesForRecord`'s `latestVersionId` (rendered as `/sfc/servlet.shepherd/version/download/{versionId}`) or any other image source.

| Property | Type | Default | Description |
|---|---|---|---|
| `images` | Array | `[]` | `[{ url, title }]`. |
| `columns` | Number | `4` | Grid columns. |

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

### Permission Gate

`c-permission-gate` &mdash; declaratively gates slotted content behind an object/field/custom permission check, instead of every consumer wiring `permissionUtils` and a `v-if` by hand. All checks provided are AND'd together.

This only hides/shows UI &mdash; it is not the security boundary. The real enforcement is server-side (`Security.stripInaccessible`, `AccessLevel.USER_MODE` in the Apex services); this component exists so users don't see controls they can't use, not to keep data from them.

```html
<c-permission-gate object-api-name="Account" required-access="delete">
    <lightning-button label="Delete" variant="destructive"></lightning-button>
    <div slot="noaccess">You don't have permission to delete accounts.</div>
</c-permission-gate>

<c-permission-gate custom-permission="Toolkit_Bulk_Edit">
    <c-bulk-action-bar ...></c-bulk-action-bar>
</c-permission-gate>
```

| Property | Type | Default | Description |
|---|---|---|---|
| `objectApiName` | String | — | Checks object-level access via `permissionUtils.getObjectAccess`. |
| `requiredAccess` | String | `'read'` | `'read'`, `'create'`, `'edit'`, or `'delete'`. Applies to both the object check and, if set, the field check. |
| `fieldApiName` | String | — | If set alongside `objectApiName`, also checks field-level access via `permissionUtils.getFieldAccess`. |
| `customPermission` | String | — | Developer name of a Custom Permission to check via `permissionUtils.hasCustomPermission`. |

**Slots**: default (shown when every configured check passes), `noaccess` (shown otherwise; defaults to a plain "You don't have access to view this." message).

### Feature Gate

`c-feature-gate` &mdash; feature-flag gate driven entirely by Custom Metadata: flip a feature on or off per org/sandbox by editing a metadata record, no deployment. Works against any `__mdt` type with a boolean field, not a hardcoded one.

```html
<c-feature-gate metadata-api-name="ToolkitDemoSetting__mdt" developer-name="Default" flag-field="IsEnabled__c">
    <c-enterprise-datatable-demo></c-enterprise-datatable-demo>
    <div slot="disabled">This feature is temporarily unavailable.</div>
</c-feature-gate>
```

| Property | Type | Default | Description |
|---|---|---|---|
| `metadataApiName` | String | — (required) | The `__mdt` type to read. |
| `developerName` | String | — (required) | The specific record's `DeveloperName`. |
| `flagField` | String | `'IsEnabled__c'` | The boolean field checked. |
| `invert` | Boolean | `false` | Show the default slot when the flag is `false` instead of `true`. |

**Slots**: default (shown when enabled), `disabled` (shown when disabled; no fallback content, so by default disabled just means "show nothing"). A missing record, or a failed lookup, is treated as disabled.

### KPI Card

`c-kpi-card` &mdash; a single stat tile for dashboards: value, label, optional trend delta and icon. Purely presentational &mdash; feed it a number from wherever (an aggregate Apex method, `GenericQueryService`'s `totalCount`, a report).

```html
<c-kpi-card label="Open Opportunities" value={openCount} format="number" icon-name="utility:opportunity"></c-kpi-card>
<c-kpi-card label="Win Rate" value={winRate} format="percent" trend="4.2" trend-label="vs last quarter"></c-kpi-card>
```

| Property | Type | Default | Description |
|---|---|---|---|
| `label` | String | `''` | |
| `value` | String/Number | — | The raw value; formatted per `format`. |
| `format` | String | `'none'` | `'none'`, `'number'`, `'currency'`, or `'percent'`. |
| `currencyCode` | String | `'USD'` | Used when `format="currency"`. |
| `trend` | Number | — | A delta, e.g. `4.2` or `-3`. Omit to hide the trend row entirely. |
| `trendLabel` | String | `''` | e.g. `'vs last month'`. |
| `iconName` | String | — | e.g. `'utility:opportunity'`. |
| `variant` | String | `'base'` | `'base'`, `'success'`, `'warning'`, or `'error'` — sets the card's accent color. |

### Date Range Picker

`c-date-range-picker` &mdash; two date inputs plus quick-range presets (Today, Last 7 Days, Last 30 Days, This Month, Last Month), validated (start &le; end), emitting ISO date strings ready to drop into a `QueryFilter` (`>=` / `<=`) for `GenericQueryService` or `c-dynamic-filter-panel`.

```html
<c-date-range-picker label="Created Date" onchange={handleRangeChange}></c-date-range-picker>
```

```js
handleRangeChange(event) {
    const { startDate, endDate } = event.detail; // ISO date strings, e.g. '2024-06-01'
}
```

| Property | Type | Default | Description |
|---|---|---|---|
| `label` | String | `'Date Range'` | |
| `startDate` / `endDate` | String | `''` | Settable ISO date strings. |
| `required` | Boolean | `false` | |
| `hidePresets` | Boolean | `false` | Hide the quick-range buttons. |

**Events**: `change` (`{ startDate, endDate }`) &mdash; fired on every valid edit (including a preset click). Not fired while `startDate > endDate`; an inline error message shows instead.

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

### lmsUtils

Thin wrapper around Lightning Message Service. Like `navigationUtils`, it can't wire `MessageContext` itself (only a component can), so every function takes the calling component's wired context as the first argument. Ships with one ready-to-use channel, `ToolkitMessageChannel__c` (fields: `recordId`, `payload`).

```js
import { MessageContext } from 'lightning/messageService';
import TOOLKIT_CHANNEL from '@salesforce/messageChannel/ToolkitMessageChannel__c';
import { createChannelController } from 'c/lmsUtils';

export default class MyComponent extends LightningElement {
    @wire(MessageContext) messageContext;
    channel;

    connectedCallback() {
        this.channel = createChannelController(this.messageContext, TOOLKIT_CHANNEL);
        this.channel.subscribe((message) => this.handleMessage(message));
    }

    disconnectedCallback() {
        this.channel.unsubscribe();
    }

    notifyOthers(recordId) {
        this.channel.publish({ recordId });
    }
}
```

| Function | Signature | Description |
|---|---|---|
| `publishMessage` | `(messageContext, channel, payload)` | Thin wrapper over `publish()`. |
| `subscribeToChannel` | `(messageContext, channel, callback, options?) => subscription` | Thin wrapper over `subscribe()`. |
| `unsubscribeFromChannel` | `(subscription)` | No-ops on a falsy subscription (safe to call unconditionally in `disconnectedCallback`). |
| `createChannelController` | `(messageContext, channel) => { publish, subscribe, unsubscribe }` | Bundles a channel + context so calling `subscribe()` a second time replaces the first subscription instead of silently creating a duplicate. |

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

**Keyset (cursor) pagination**, for large or fast-growing tables where OFFSET gets slower the deeper you page:

```apex
@AuraEnabled(cacheable=true)
public static CursorQueryResult queryWithCursor(
    String objectApiName, List<String> fields, List<QueryFilter> filters,
    String searchTerm, List<String> searchFields, String afterId, Integer pageSize
)
```

- Returns a `CursorQueryResult`: `{ records, hasMore, nextCursor }`. There is no `totalCount` or page number &mdash; keyset pagination only ever knows "is there a next page" and "what cursor gets it".
- Always sorted by `Id ASC` (the trade-off that makes it cheap at any depth); pass the previous page's `nextCursor` as `afterId` to get the next page. `nextCursor` is `null` when `hasMore` is `false`.
- Same filter/search/security semantics as `query()`.

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

### FileManagerService (Apex)

```apex
@AuraEnabled(cacheable=true)
public static List<FileInfo> getFilesForRecord(Id recordId)
// FileInfo => { contentDocumentId, latestVersionId, title, fileExtension, contentSize, createdDate }

@AuraEnabled
public static void deleteFile(Id contentDocumentId)
```

Backs `c-file-upload-manager`. Reads/deletes `ContentDocument`/`ContentDocumentLink` under `AccessLevel.USER_MODE`/`WITH USER_MODE`; uploading itself is handled by the platform's `lightning-file-upload` base component, not this class.

---

## Running the tests

```bash
npm install
npm test             # Jest — 190 tests across every LWC/util module
npm run lint          # ESLint
```

Apex tests (`*Test.cls`, 24 methods) run in your org:

```bash
sf apex run test -o lwc-toolkit -c -r human
```
