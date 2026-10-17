# salesforce-lwc-production-toolkit

**[Website](https://amitshq.github.io/salesforce-lwc-production-toolkit/)** &middot; **[Usage guide](USAGE.md)**

Reusable, production-grade Lightning Web Components and Apex services for the pieces every Salesforce project ends up rebuilding: a generic server-side datatable, a modal framework, error/state handling, and the small utility functions that don't deserve a bespoke implementation per project.

This is not a `lightning-button` wrapper library. Everything here either does something non-trivial (server-side pagination + partial-error reporting) or removes genuine, repeated boilerplate (Apex/LDS error parsing, debounce, nested-path access).

## Why

Every Salesforce project eventually builds some version of a server-side, sortable, filterable, editable datatable with bulk actions - and re-derives the same Apex error parsing, the same modal boilerplate, the same loading/empty/error branch. This package is that "some version," built once, tested, and documented, so the question stops being "why are we rebuilding this again?"

## Requirements

- Salesforce CLI (`sf`), authenticated to a Dev Hub or sandbox
- API 61.0+ org (Summer '24+) - the toolkit uses `AccessLevel.USER_MODE`, `Security.stripInaccessible`, `Database.queryWithBinds`/`countQueryWithBinds`, and `lightning/modal`, all of which need a reasonably current org
- Node.js 18+ (for linting/Jest only - not required to deploy)

## Setup

```bash
sf org create scratch -f config/project-scratch-def.json -a lwc-toolkit -d 7
sf project deploy start -o lwc-toolkit
sf org assign permset -o lwc-toolkit -n LWCToolkitAdmin
sf org open -o lwc-toolkit
```

`LWCToolkitAdmin` grants access to the four Apex services, the `Toolkit_Bulk_Edit` custom permission, and read access to the `ToolkitDemoSetting__mdt` custom metadata fields. Assign it to any user who should see the demo data load correctly.

Then drop **Enterprise Datatable Demo (Accounts)** onto an App Page, Record Page, or Home Page from Lightning App Builder to see the whole pipeline running against Account, or open `enterpriseDatatableDemo` for the wiring pattern to copy for your own object.

### Local development (linting/tests only)

```bash
npm install
npm test            # Jest unit tests for every LWC/util module
npm run lint         # ESLint
npm run prettier     # format everything
```

190 Jest tests and 24 Apex test methods cover the components and services below.

## Architecture

```
force-app/main/default/
├── classes/          Generic Apex services (query, DML, permissions, custom metadata, files)
├── customMetadata/   Demo config record consumed by metadataUtils
├── customPermissions/  Toolkit_Bulk_Edit, gating bulk edit/delete in the demo
├── messageChannels/   ToolkitMessageChannel, backing lmsUtils
├── objects/           ToolkitDemoSetting__mdt (the demo's configuration type)
├── permissionsets/     LWCToolkitAdmin
└── lwc/
    ├── enterpriseDatatable/       the flagship component
    ├── enterpriseDatatableDemo/   ready-to-drop Account example
    ├── multiSelectLookup, dynamicFilterPanel, dynamicForm, pagination,
    │   fileUploadManager, imageGallery                other data components
    ├── modal, confirmDialog, wizard, stateManager, emptyState, errorState,
    │   bulkActionBar, infiniteScrollLoader, permissionGate, featureGate,
    │   kpiCard, dateRangePicker                        UX components
    └── functionUtils, objectUtils, jsonUtils, urlUtils, apexErrorUtils,
        ldsErrorUtils, navigationUtils, recordUtils, permissionUtils,
        metadataUtils, toastService, lmsUtils           data/Salesforce utility modules
```

### The generic Apex layer

Rather than a bespoke `@AuraEnabled` controller per object, four schema-driven services back everything:

- **`GenericQueryService.query(...)`** - dynamic SOQL: object/field/filter identifiers are validated against the running user's schema describe (never concatenated as literals), values are always bound via `Database.queryWithBinds`/`countQueryWithBinds`, and the query itself runs under `AccessLevel.USER_MODE` as a second layer of CRUD/FLS enforcement. Supports paging, sorting, per-field filters, and a multi-field `LIKE` search.
- **`GenericDmlService.saveRecords(...)` / `.deleteRecords(...)`** - bulk insert/update/delete with `allOrNone=false`, `Security.stripInaccessible` for FLS, and a `DmlResult` per row (correlated by `rowKey`) so a batch save reports exactly which rows failed instead of aborting the whole batch.
- **`PermissionService`** - object/field access checks and a custom-permission check (via `SetupEntityAccess`/`PermissionSetAssignment`, since Apex has no direct "does this user have this custom permission" API).
- **`CustomMetadataService`** - generic Custom Metadata Type reader, validated to only ever query `__mdt` objects.

### The flagship: `c-enterprise-datatable`

```
Server-side query → Pagination → Filtering → Sorting → Inline editing → Bulk update → Partial errors → Refresh
```

Point it at an object and a (mostly standard `lightning-datatable`) column array:

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
    onbulkaction={handleBulkAction}
></c-enterprise-datatable>
```

```js
columns = [
    { label: 'Name', fieldName: 'Name', type: 'text', editable: true, filterable: true },
    { label: 'Owner', fieldName: 'Owner.Name', type: 'text' } // relationship fields are auto-flattened
];
```

What it does with that config:

- **Server-side query** via `GenericQueryService`, fields derived automatically from your `columns`.
- **Pagination**: `pagination-mode="pages"` (Previous/Next + a page indicator) or `"infinite"` (a `c-infinite-scroll-loader` sentinel at the bottom, IntersectionObserver-based).
- **Filtering**: any column with `filterable: true` gets a quick-filter input; `filterOperator` (default `'='`) controls the SOQL operator per column.
- **Sorting**: native `lightning-datatable` column-header sort, re-queried server-side.
- **Multi-select + bulk actions**: `enable-row-selection` turns on the checkbox column; selected rows drive `c-bulk-action-bar`. Pass your own `bulk-actions` (re-emitted as a `bulkaction` event for you to handle) and/or set `enable-bulk-delete` for a built-in destructive action, gated on `PermissionService.checkObjectAccess(...).isDeletable` and a `c-confirm-dialog` confirmation.
- **Inline editing → bulk update → partial errors**: edited rows save through `GenericDmlService.saveRecords` in one batch; failed rows stay in `draft-values` and are marked via `lightning-datatable`'s `errors` prop with the server's message, while successful rows commit and fire a success toast - a save of 20 rows where 2 fail doesn't lose your other 18 edits.
- **Refresh**: a header button, plus a public `@api refresh()` for a parent (or a Lightning quick action) to call.
- Relationship-path columns (`fieldName: 'Owner.Name'`) are queried as-is and flattened onto an alias key, since `lightning-datatable` requires flat, dot-free field names.

`c-enterprise-datatable-demo` wires all of this against Account, including reading the default page size from `ToolkitDemoSetting__mdt` via `metadataUtils` and gating its bulk-delete action on the `Toolkit_Bulk_Edit` custom permission via `permissionUtils` - copy that component as the starting point for your own object.

## Feature map

### Data components

| Requested | Where |
|---|---|
| Generic server-side datatable | [`enterpriseDatatable`](force-app/main/default/lwc/enterpriseDatatable) + [`GenericQueryService`](force-app/main/default/classes/GenericQueryService.cls) |
| Infinite scrolling | [`infiniteScrollLoader`](force-app/main/default/lwc/infiniteScrollLoader) (standalone) + `enterpriseDatatable`'s `pagination-mode="infinite"` |
| Server-side pagination | `enterpriseDatatable`'s `pagination-mode="pages"`, `GenericQueryService` offset/limit |
| Sorting/filtering | `enterpriseDatatable` column sort + per-column `filterable` quick filters |
| Multi-select | `enterpriseDatatable`'s `enable-row-selection` (native `lightning-datatable` checkboxes) |
| Inline editing | `enterpriseDatatable`'s `draft-values`/`onsave` wired to `GenericDmlService` |
| Bulk actions | [`bulkActionBar`](force-app/main/default/lwc/bulkActionBar) (standalone) + `enterpriseDatatable`'s `bulk-actions`/`enable-bulk-delete` |
| Advanced data table | `enterpriseDatatable` above &mdash; this *is* that component, not a second one |
| Multi-select lookup | [`multiSelectLookup`](force-app/main/default/lwc/multiSelectLookup) - type-to-search against any object via `GenericQueryService` |
| Dynamic filter panel | [`dynamicFilterPanel`](force-app/main/default/lwc/dynamicFilterPanel) - builds `QueryFilter[]` for `GenericQueryService`/`enterpriseDatatable` |
| Dynamic form | [`dynamicForm`](force-app/main/default/lwc/dynamicForm) - renders from a field-config array, field-level-access-aware |
| Pagination / keyset pagination | [`pagination`](force-app/main/default/lwc/pagination) (standalone) + [`GenericQueryService.queryWithCursor`](force-app/main/default/classes/GenericQueryService.cls) |
| File upload manager | [`fileUploadManager`](force-app/main/default/lwc/fileUploadManager) + [`FileManagerService.cls`](force-app/main/default/classes/FileManagerService.cls) |
| Image gallery | [`imageGallery`](force-app/main/default/lwc/imageGallery) - thumbnail grid + `c-modal` lightbox |

### UX components

| Requested | Where |
|---|---|
| Modal framework | [`modal`](force-app/main/default/lwc/modal) - slot-based, focus-trapped, works anywhere (Experience Cloud/LWR included) |
| Confirmation dialog | [`confirmDialog`](force-app/main/default/lwc/confirmDialog) - promise-based, built on `lightning/modal` |
| Toast manager | [`toastService`](force-app/main/default/lwc/toastService) - consistent `ShowToastEvent` dispatch with de-duplication |
| Loading/state manager | [`stateManager`](force-app/main/default/lwc/stateManager) |
| Empty-state component | [`emptyState`](force-app/main/default/lwc/emptyState) |
| Error-state component | [`errorState`](force-app/main/default/lwc/errorState) |
| Wizard/stepper | [`wizard`](force-app/main/default/lwc/wizard) - `lightning-progress-indicator` + cancelable `beforestepchange` for per-step validation |
| Confirmation modal | `confirmDialog` above |
| Error panel | `errorState` above |
| Permission-aware component | [`permissionGate`](force-app/main/default/lwc/permissionGate) - gates slotted content on object/field/custom-permission checks |
| Metadata-driven configuration provider | [`featureGate`](force-app/main/default/lwc/featureGate) - feature-flag gating driven by any Custom Metadata Type |
| KPI dashboard card | [`kpiCard`](force-app/main/default/lwc/kpiCard) |
| Date range picker | [`dateRangePicker`](force-app/main/default/lwc/dateRangePicker) - with quick-range presets |

### Data utilities

| Requested | Where |
|---|---|
| Debounce/throttle | [`functionUtils`](force-app/main/default/lwc/functionUtils) |
| Deep clone | [`objectUtils.deepClone`](force-app/main/default/lwc/objectUtils/objectUtils.js) |
| Object comparison | [`objectUtils.isEqual`](force-app/main/default/lwc/objectUtils/objectUtils.js) |
| Nested property access | [`objectUtils.getNestedValue`/`setNestedValue`](force-app/main/default/lwc/objectUtils/objectUtils.js) |
| JSON formatting | [`jsonUtils`](force-app/main/default/lwc/jsonUtils) |
| URL/query parameter helpers | [`urlUtils`](force-app/main/default/lwc/urlUtils) |

### Salesforce utilities

| Requested | Where |
|---|---|
| Apex error parser | [`apexErrorUtils`](force-app/main/default/lwc/apexErrorUtils) |
| LDS error parser | [`ldsErrorUtils`](force-app/main/default/lwc/ldsErrorUtils) |
| Navigation helpers | [`navigationUtils`](force-app/main/default/lwc/navigationUtils) |
| Record refresh helpers | [`recordUtils`](force-app/main/default/lwc/recordUtils) - pairs `refreshApex` with `notifyRecordUpdateAvailable` in one call |
| Permission checking | [`permissionUtils`](force-app/main/default/lwc/permissionUtils) + [`PermissionService.cls`](force-app/main/default/classes/PermissionService.cls) |
| Custom metadata configuration loader | [`metadataUtils`](force-app/main/default/lwc/metadataUtils) + [`CustomMetadataService.cls`](force-app/main/default/classes/CustomMetadataService.cls) |
| LMS (Lightning Message Service) wrapper | [`lmsUtils`](force-app/main/default/lwc/lmsUtils) + [`ToolkitMessageChannel`](force-app/main/default/messageChannels) |

## Known limitations / extension points

- The App Builder property panel only exposes `enterpriseDatatable`'s primitive properties (object, title, page size, ...) - `columns`, `staticFilters`, `bulkActions`, and `searchFields` are arrays/objects and must be set by wrapping the component in your own LWC (as `enterpriseDatatableDemo` does), not by an admin in Lightning App Builder.
- `GenericDmlService` supports insert/update/delete; it does not run Apex triggers differently than any other DML, so validation rules/triggers on the target object still apply and their errors surface through the normal partial-error path.
- Custom Metadata field-level filtering in `metadataUtils`/`CustomMetadataService` returns full records (no server-side filtering by field value) - it's a configuration loader, not a query engine; use `GenericQueryService` if you need to query a `__mdt` type with filters.
- `dynamicForm`'s `picklist` field type doesn't call `getPicklistValuesByRecordType` for you - pass `options` explicitly, since record-type-aware picklists are a meaningfully bigger feature than this component takes on.
- `GenericQueryService.queryWithCursor` (keyset pagination) is always sorted `Id ASC` - it doesn't support arbitrary-field sort with tie-breaking, which is a substantially more complex feature; use `query()` (offset pagination) when you need to sort by something else.
