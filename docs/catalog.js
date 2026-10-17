/* Component / utility / Apex catalog shown on the website. Plain data so it can be loaded by the
   page (window.TOOLKIT_CATALOG) and by the Node checks in catalog.check.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TOOLKIT_CATALOG = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  return [
    {
      id: 'enterprise-datatable',
      name: 'c-enterprise-datatable',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/enterpriseDatatable',
      tagline: 'The flagship: server-side query, pagination, sorting, filtering, inline edit, bulk actions, and partial-error reporting for any object.',
      usage:
        '<c-enterprise-datatable\n    object-api-name="Account"\n    title="Accounts"\n    columns={columns}\n    page-size="25"\n    pagination-mode="pages"\n    search-fields={searchFields}\n    bulk-actions={bulkActions}\n    enable-row-selection\n    enable-bulk-delete\n    default-sort-field="Name"\n    onbulkaction={handleBulkAction}\n></c-enterprise-datatable>',
      api: [
        ['objectApiName', 'String', '— (required)', 'The sObject to query, e.g. \'Account\'.'],
        ['columns', 'Array', '[]', 'Standard lightning-datatable columns, plus filterable/filterOperator.'],
        ['pageSize', 'Number', '25', 'Rows per page/batch.'],
        ['paginationMode', 'String', "'pages'", "'pages' or 'infinite'."],
        ['searchFields', 'Array<String>', '[]', 'Fields the global search box searches.'],
        ['staticFilters', 'Array', '[]', 'Always-applied filters: [{ fieldName, operatorName, value }].'],
        ['enableRowSelection', 'Boolean', 'false', 'Shows the checkbox column + bulk action bar.'],
        ['enableBulkDelete', 'Boolean', 'false', "Built-in 'Delete' bulk action, gated on CRUD + confirmation."],
        ['enableConflictDetection', 'Boolean', 'false', 'Reject an inline edit, instead of overwriting, if someone else changed the record after it was loaded (compare on SystemModstamp).'],
        ['enableColumnChooser', 'Boolean', 'false', 'Header button that lets each user hide and show columns.'],
        ['viewKey', 'String', '—', 'Turns on per-user saved views. Any key unique to this table, e.g. accounts-main. The first query waits for the default view.'],
        ['autoRefresh', 'Boolean', 'false', 'Follow changes made elsewhere (needs Change Data Capture on the object). Reloads quietly only when nothing is being edited or selected; otherwise shows a "records changed" bar.']
      ],
      events: [
        ['bulkaction', '{ name, selectedRows }', 'A bulkActions entry (not the built-in delete) was clicked.'],
        ['liveerror', '{ message }', 'auto-refresh could not subscribe; the table keeps working without live updates.']
      ],
      methods: [
        ['refresh()', 'Promise<void>', 'Re-runs the current query; clears selection/in-progress edits.'],
        ['applyConfig(config)', 'Promise<void>', 'Applies a layout from currentConfig or a saved view (columns, sort, search, filters) and re-queries from page 1. Unknown columns are ignored; null resets to the defaults.'],
        ['currentConfig', 'Object', 'Getter: the table\'s current layout as a plain, JSON-safe object.']
      ]
    },
    {
      id: 'aggregate-kpi-card',
      name: 'c-aggregate-kpi-card',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/aggregateKpiCard',
      tagline: 'A KPI tile that computes its own COUNT / SUM / AVG / MIN / MAX server-side, with an optional period-over-period trend.',
      usage:
        "<c-aggregate-kpi-card\n    label=\"Open pipeline\"\n    object-api-name=\"Opportunity\"\n    function-name=\"SUM\"\n    field-name=\"Amount\"\n    filters={openFilters}\n    comparison-filters={lastMonthFilters}\n    trend-label=\"vs last month\"\n    format=\"currency\"\n></c-aggregate-kpi-card>\n\n// openFilters = [{ fieldName: 'IsClosed', operatorName: '=', value: false }]",
      api: [
        ['objectApiName', 'String', '— (required)', 'The sObject to aggregate.'],
        ['functionName', 'String', "'COUNT'", 'COUNT, SUM, AVG, MIN or MAX. SUM and AVG need a numeric field.'],
        ['fieldName', 'String', '—', 'Field to aggregate. Leave blank for COUNT to count records.'],
        ['filters', 'Array', '[]', 'QueryFilter[]: [{ fieldName, operatorName, value }].'],
        ['comparisonFilters', 'Array', '—', 'A second, complete filter set. When given, the same aggregate runs again and the percentage change is shown as the trend.'],
        ['label / trendLabel', 'String', "''", 'Card label and the text next to the trend, e.g. \'vs last month\'.'],
        ['format / currencyCode / iconName / variant', 'String', '—', 'Passed through to c-kpi-card.']
      ],
      methods: [['refresh()', 'Promise<void>', 'Re-runs the query. It also re-runs by itself whenever a setting changes, and ignores a slow response that arrives after a newer one.']]
    },
    {
      id: 'csv-import-wizard',
      name: 'c-csv-import-wizard',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/csvImportWizard',
      tagline: 'Upload a CSV, map its columns, review what will happen, then import in chunks with per-row error reporting.',
      usage:
        "<c-csv-import-wizard\n    object-api-name=\"Account\"\n    fields={importFields}\n    onimportcomplete={handleImportComplete}\n></c-csv-import-wizard>\n\nimportFields = [\n    { apiName: 'Name', label: 'Account Name', type: 'text', required: true },\n    { apiName: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency' }\n];",
      api: [
        ['objectApiName', 'String', '— (required)', 'The sObject to insert into / update.'],
        ['fields', 'Array', '[]', '[{ apiName, label, type, required }] — the fields a column may be mapped to. type: text, number/currency/percent, checkbox, date, datetime, email.'],
        ['chunkSize', 'Number', '200', 'Rows per GenericDmlService.saveRecords call; each chunk is its own transaction.'],
        ['maxRows', 'Number', '5000', 'Larger files are refused with a message (the file limit is 5 MB).']
      ],
      events: [['importcomplete', '{ successCount, failureCount, validationFailureCount, notAttemptedCount, emptyRowCount }', 'The import finished, or was cancelled between chunks.']],
      methods: [['reset()', 'void', 'Back to the upload step; call it when the surrounding modal closes.']]
    },
    {
      id: 'datatable-view-bar',
      name: 'c-datatable-view-bar',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/datatableViewBar',
      tagline: 'The saved-views toolbar behind the datatable\'s view-key: pick, save, update, delete and default a view.',
      usage:
        '<c-datatable-view-bar\n    view-key="accounts-main"\n    object-api-name="Account"\n    current-config={currentConfig}\n    onviewsready={handleViewsReady}\n    onviewselect={handleViewSelect}\n></c-datatable-view-bar>',
      api: [
        ['viewKey', 'String', '— (required)', 'Identifies the table; views are stored per user and key.'],
        ['objectApiName', 'String', '—', 'Stored with each view for administration.'],
        ['currentConfig', 'Object', '—', 'The table\'s current settings. Saved as JSON, handed back unchanged, and compared with the selected view to show "Unsaved changes".']
      ],
      events: [
        ['viewsready', '{ viewId, config }', 'Once, after the first load: the default view\'s settings, or config null. Fired even if loading failed.'],
        ['viewselect', '{ viewId, config }', 'The user picked a view; config is null for "All records" (reset).']
      ]
    },
    {
      id: 'column-chooser',
      name: 'c-column-chooser',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/columnChooser',
      tagline: 'A checkbox panel for choosing which table columns are shown; the last visible column cannot be hidden.',
      usage:
        '<c-column-chooser\n    columns={chooserColumns}\n    visible-fields={visibleFields}\n    onchange={handleChange}\n></c-column-chooser>\n\n// chooserColumns = [{ fieldName: \'Name\', label: \'Account Name\' }, ...]\n// handleChange(event) -> event.detail.visibleFields',
      api: [
        ['columns', 'Array', '[]', '[{ fieldName, label }]. Entries without a fieldName are ignored.'],
        ['visibleFields', 'Array<String>', 'null', 'The fields currently shown; omit or null for all.']
      ],
      events: [['change', '{ visibleFields }', 'A box was toggled, or "Show all" was clicked. Always in column order.']]
    },
    {
      id: 'multi-select-lookup',
      name: 'c-multi-select-lookup',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/multiSelectLookup',
      tagline: 'Type-to-search against any object, pick several records, remove them as pills. No bespoke Apex.',
      usage:
        '<c-multi-select-lookup\n    label="Contacts"\n    object-api-name="Contact"\n    label-field="Name"\n    search-fields={searchFields}\n    selected-records={selectedContacts}\n    onchange={handleContactsChange}\n></c-multi-select-lookup>',
      api: [
        ['objectApiName', 'String', '— (required)', 'Object to search.'],
        ['labelField', 'String', "'Name'", 'Field shown for each result.'],
        ['searchFields', 'Array<String>', '[labelField]', 'Fields searched (LIKE, OR\'d).'],
        ['staticFilters', 'Array', '[]', 'Always-applied QueryFilters.'],
        ['selectedRecords', 'Array', '[]', '[{ id, label }]; settable to pre-populate.'],
        ['minSearchLength / pageSize', 'Number', '2 / 10', 'Characters before a search fires; max results shown.']
      ],
      events: [['change', '{ value: [{ id, label }] }', 'On every add or remove.']]
    },
    {
      id: 'dynamic-filter-panel',
      name: 'c-dynamic-filter-panel',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/dynamicFilterPanel',
      tagline: 'Builds filter conditions and emits them in exactly the QueryFilter shape GenericQueryService expects.',
      usage:
        '<c-dynamic-filter-panel fields={filterableFields} onchange={handleFiltersChange}></c-dynamic-filter-panel>\n\nfilterableFields = [\n    { label: \'Industry\', value: \'Industry\', type: \'text\' },\n    { label: \'Annual Revenue\', value: \'AnnualRevenue\', type: \'currency\' }\n];',
      api: [
        ['fields', 'Array', '[]', '[{ label, value, type }]; type is text, number, currency, date, boolean or picklist.'],
        ['addLabel', 'String', "'Add filter'", 'Label of the add-a-condition button.']
      ],
      events: [['change', '{ value: QueryFilter[] }', 'A row was added, edited or removed. Incomplete rows are left out.']],
      methods: [
        ['addCondition()', 'void', 'Adds an empty row.'],
        ['clearAll()', 'void', 'Removes every row.']
      ]
    },
    {
      id: 'dynamic-form',
      name: 'c-dynamic-form',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/dynamicForm',
      tagline: 'Renders a form from a plain field-config array, field-level-access aware; pairs with GenericDmlService.saveRecords.',
      usage:
        '<c-dynamic-form fields={fields} object-api-name="Contact" onsubmit={handleSubmit}></c-dynamic-form>\n\nfields = [\n    { apiName: \'LastName\', label: \'Last Name\', type: \'text\', required: true },\n    { apiName: \'Email\', label: \'Email\', type: \'email\' }\n];',
      api: [
        ['fields', 'Array', '[]', '[{ apiName, label, type, required?, options?, defaultValue?, helpText? }]'],
        ['objectApiName', 'String', '—', 'When set, read-only fields are disabled (the server still enforces FLS).'],
        ['values', 'Object', '{}', 'Pre-fills the form.'],
        ['submitLabel / cancelLabel', 'String', "'Save' / 'Cancel'", 'Button labels.'],
        ['hideSubmitButton / hideCancelButton', 'Boolean', 'false', 'Drive submission from your own toolbar.']
      ],
      events: [
        ['submit', '{ values }', 'Only after reportValidity() passes.'],
        ['cancel', '(none)', 'Cancel was clicked.']
      ],
      methods: [
        ['getValues()', 'Object', 'The current values.'],
        ['reportValidity()', 'Boolean', 'Runs each field\'s validation.'],
        ['reset()', 'void', 'Clears the form.']
      ]
    },
    {
      id: 'pagination',
      name: 'c-pagination',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/pagination',
      tagline: 'Standalone Previous / Next + numbered page control, fully controlled by props.',
      usage:
        '<c-pagination\n    current-page={currentPage}\n    total-records={totalRecords}\n    page-size={pageSize}\n    onpagechange={handlePageChange}\n></c-pagination>',
      api: [
        ['currentPage', 'Number', '1', ''],
        ['totalRecords', 'Number', '0', ''],
        ['pageSize', 'Number', '25', ''],
        ['maxPageButtons', 'Number', '5', 'Numbered buttons shown, windowed around the current page.']
      ],
      events: [['pagechange', '{ page }', 'The user asked for another page.']]
    },
    {
      id: 'file-upload-manager',
      name: 'c-file-upload-manager',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/fileUploadManager',
      tagline: 'Upload, list and delete the files attached to a record, backed by FileManagerService.',
      usage: '<c-file-upload-manager record-id={recordId} accepted-formats={acceptedFormats}></c-file-upload-manager>',
      api: [
        ['recordId', 'String', '— (required)', 'The record files are attached to.'],
        ['label', 'String', "'Files'", 'Card title.'],
        ['acceptedFormats', 'Array<String>', "['.pdf', '.png', ...]", 'Passed to lightning-file-upload.'],
        ['singleFileOnly', 'Boolean', 'false', 'One file per upload.'],
        ['hideUploadArea', 'Boolean', 'false', 'Show only the list (read-only).']
      ],
      methods: [['refresh()', 'void', 'Reloads the file list.']]
    },
    {
      id: 'image-gallery',
      name: 'c-image-gallery',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/imageGallery',
      tagline: 'Thumbnail grid with a click-to-enlarge lightbox (Previous / Next and arrow keys).',
      usage: '<c-image-gallery images={images}></c-image-gallery>\n\nimages = [{ url: \'/path/to/img.jpg\', title: \'Site photo 1\' }];',
      api: [
        ['images', 'Array', '[]', '[{ url, title }]'],
        ['columns', 'Number', '4', 'Grid columns.']
      ]
    },
    {
      id: 'infinite-scroll-loader',
      name: 'c-infinite-scroll-loader',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/infiniteScrollLoader',
      tagline: 'IntersectionObserver-based "load more" sentinel, reusable for any list or grid.',
      usage:
        '<template for:each={rows} for:item="row"> ... </template>\n<c-infinite-scroll-loader\n    is-loading={isLoadingMore}\n    disabled={allRowsLoaded}\n    onloadmore={handleLoadMore}\n></c-infinite-scroll-loader>',
      api: [
        ['isLoading', 'Boolean', 'false', 'Shows a small spinner; suppresses further loadmore events.'],
        ['disabled', 'Boolean', 'false', 'Set true once there is nothing left to load.'],
        ['rootMargin', 'String', "'100px'", 'How far before the sentinel is visible that it fires.']
      ],
      events: [['loadmore', '(none)', 'The sentinel scrolled into view and more can be fetched.']]
    },
    {
      id: 'bulk-action-bar',
      name: 'c-bulk-action-bar',
      category: 'Data components',
      kind: 'LWC',
      path: 'lwc/bulkActionBar',
      tagline: '"N selected" toolbar for any multi-select list, independent of the datatable.',
      usage:
        '<c-bulk-action-bar\n    selected-count={selectedRows.length}\n    actions={bulkActions}\n    onaction={handleBulkAction}\n    onclear={handleClearSelection}\n></c-bulk-action-bar>',
      api: [
        ['selectedCount', 'Number', '0', 'Renders nothing when 0.'],
        ['actions', 'Array', '[]', '[{ name, label, variant, iconName, disabled }]']
      ],
      events: [
        ['action', '{ name, selectedCount }', 'An action button was clicked.'],
        ['clear', '(none)', 'The clear-selection button was clicked.']
      ]
    },
    {
      id: 'modal',
      name: 'c-modal',
      category: 'UX components',
      kind: 'LWC',
      path: 'lwc/modal',
      tagline: 'Declarative, slot-based modal framework for content authored inline in a template. Works in Experience Cloud/LWR too.',
      usage:
        '<c-modal header-label="Edit Contact" onclose={handleClose}>\n    <div class="slds-p-around_medium">... body ...</div>\n    <div slot="footer">\n        <lightning-button label="Cancel" onclick={handleCancel}></lightning-button>\n        <lightning-button label="Save" variant="brand" onclick={handleSave}></lightning-button>\n    </div>\n</c-modal>\n\n// imperatively:\nthis.template.querySelector(\'c-modal\').open();',
      api: [
        ['headerLabel', 'String', "''", 'Modal header text.'],
        ['size', 'String', "'medium'", "'small' | 'medium' | 'large' | 'full'"],
        ['preventCloseOnBackdropClick', 'Boolean', 'false', 'Disable closing on backdrop click.'],
        ['hideCloseButton', 'Boolean', 'false', 'Hides the header X button.']
      ],
      methods: [
        ['open()', 'void', 'Opens the modal, traps focus.'],
        ['close()', 'void', 'Closes the modal, restores focus.']
      ],
      events: [['close', '(none)', 'Dispatched after the modal closes, any way it closed.']]
    },
    {
      id: 'confirm-dialog',
      name: 'c-confirm-dialog',
      category: 'UX components',
      kind: 'LWC',
      path: 'lwc/confirmDialog',
      tagline: 'Promise-based confirmation dialog built on the platform lightning/modal service.',
      usage:
        "import ConfirmDialog from 'c/confirmDialog';\n\nasync handleDelete() {\n    const confirmed = await ConfirmDialog.open({\n        label: 'Delete Records',\n        message: 'This will permanently delete 3 records.',\n        variant: 'destructive',\n        confirmLabel: 'Delete'\n    });\n    if (confirmed) { /* proceed */ }\n}",
      api: [
        ['label', 'String', "'Confirm'", 'Dialog header.'],
        ['message', 'String', "'Are you sure?'", 'Body text.'],
        ['variant', 'String', "'neutral'", "'neutral' or 'destructive'."],
        ['confirmLabel', 'String', "'Confirm'", ''],
        ['cancelLabel', 'String', "'Cancel'", '']
      ],
      methods: [['ConfirmDialog.open(options)', 'Promise<Boolean>', 'Resolves true (confirmed) or false (canceled/dismissed).']]
    },
    {
      id: 'state-manager',
      name: 'c-state-manager',
      category: 'UX components',
      kind: 'LWC',
      path: 'lwc/stateManager',
      tagline: "The loading/error/empty/content branch, so you don't write it by hand in every component.",
      usage:
        '<c-state-manager\n    is-loading={isLoading}\n    has-error={hasError}\n    error-message={errorMessage}\n    is-empty={isEmpty}\n    empty-title="No records found"\n>\n    <template for:each={rows} for:item="row">...</template>\n</c-state-manager>',
      api: [
        ['isLoading', 'Boolean', 'false', 'Shows the loading slot.'],
        ['hasError', 'Boolean', 'false', 'Shows the error slot.'],
        ['errorMessage', 'String', "''", 'Passed to the default c-error-state.'],
        ['isEmpty', 'Boolean', 'false', 'Shows the empty slot.']
      ]
    },
    {
      id: 'empty-state',
      name: 'c-empty-state',
      category: 'UX components',
      kind: 'LWC',
      path: 'lwc/emptyState',
      tagline: 'Presentational "no data" placeholder with an actions slot, used standalone or via c-state-manager.',
      usage:
        '<c-empty-state title="No accounts yet" message="Create your first account." icon-name="utility:add">\n    <lightning-button slot="actions" label="New Account" variant="brand"></lightning-button>\n</c-empty-state>',
      api: [
        ['title', 'String', "'Nothing to show'", ''],
        ['message', 'String', "''", ''],
        ['iconName', 'String', "'utility:open_folder'", '']
      ]
    },
    {
      id: 'error-state',
      name: 'c-error-state',
      category: 'UX components',
      kind: 'LWC',
      path: 'lwc/errorState',
      tagline: 'Presentational error placeholder with a retry button and collapsible raw-error details.',
      usage: '<c-error-state message={errorMessage} details={rawErrorJson} onretry={handleRetry}></c-error-state>',
      api: [
        ['title', 'String', "'Something went wrong'", ''],
        ['message', 'String', "''", ''],
        ['hideRetry', 'Boolean', 'false', 'Hides the retry button.'],
        ['details', 'String', "''", 'Raw error text, shown behind a toggle.']
      ],
      events: [['retry', '(none)', 'The retry button was clicked.']]
    },
    {
      id: 'wizard',
      name: 'c-wizard',
      category: 'UX components',
      kind: 'LWC',
      path: 'lwc/wizard',
      tagline: 'Multi-step flow with a progress indicator and cancelable per-step validation.',
      usage:
        '<c-wizard steps={steps} onbeforestepchange={handleBeforeStepChange} onfinish={handleFinish}>\n    <div data-step="details">... step 1 ...</div>\n    <div data-step="review">... step 2 ...</div>\n</c-wizard>',
      api: [['steps', 'Array', '[]', '[{ label, value }]'],
        ['hideNavigation', 'Boolean', 'false', 'Hides the built-in Back/Next/Finish buttons.']],
      methods: [
        ['next()', 'Boolean', 'Advances one step.'],
        ['back()', 'Boolean', 'Goes back one step.'],
        ['goToStep(value)', 'Boolean', 'Jumps to a named step.']
      ],
      events: [
        ['beforestepchange', '{ fromValue, toValue }', 'Cancelable - call event.preventDefault() to block advancing.'],
        ['stepchange', '{ value, index }', 'After a transition completes.'],
        ['finish', '{ value }', 'Finish clicked on the last step.']
      ]
    },
    {
      id: 'permission-gate',
      name: 'c-permission-gate',
      category: 'UX components',
      kind: 'LWC',
      path: 'lwc/permissionGate',
      tagline: 'Shows slotted content only if the user passes the object / field / custom-permission checks. UI only, not the security boundary.',
      usage:
        '<c-permission-gate object-api-name="Account" required-access="delete">\n    <lightning-button label="Delete" variant="destructive"></lightning-button>\n    <div slot="noaccess">You don\'t have permission to delete accounts.</div>\n</c-permission-gate>',
      api: [
        ['objectApiName', 'String', '—', 'Object-level check.'],
        ['requiredAccess', 'String', "'read'", 'read, create, edit or delete.'],
        ['fieldApiName', 'String', '—', 'Also check this field.'],
        ['customPermission', 'String', '—', 'Developer name of a Custom Permission.']
      ]
    },
    {
      id: 'feature-gate',
      name: 'c-feature-gate',
      category: 'UX components',
      kind: 'LWC',
      path: 'lwc/featureGate',
      tagline: 'Feature flags driven by Custom Metadata: flip a feature per org by editing a record, no deployment.',
      usage:
        '<c-feature-gate metadata-api-name="ToolkitDemoSetting__mdt" developer-name="Default" flag-field="IsEnabled__c">\n    <c-enterprise-datatable-demo></c-enterprise-datatable-demo>\n    <div slot="disabled">This feature is temporarily unavailable.</div>\n</c-feature-gate>',
      api: [
        ['metadataApiName', 'String', '— (required)', 'The __mdt type to read.'],
        ['developerName', 'String', '— (required)', 'The record\'s DeveloperName.'],
        ['flagField', 'String', "'IsEnabled__c'", 'The boolean field checked.'],
        ['invert', 'Boolean', 'false', 'Show the default slot when the flag is false.']
      ]
    },
    {
      id: 'kpi-card',
      name: 'c-kpi-card',
      category: 'UX components',
      kind: 'LWC',
      path: 'lwc/kpiCard',
      tagline: 'A single stat tile: value, label, optional trend and icon. Presentational; use c-aggregate-kpi-card to have it compute the number.',
      usage:
        '<c-kpi-card label="Win Rate" value={winRate} format="percent" trend="4.2" trend-label="vs last quarter"></c-kpi-card>',
      api: [
        ['label', 'String', "''", ''],
        ['value', 'String/Number', '—', 'Formatted per format.'],
        ['format', 'String', "'none'", 'none, number, currency or percent.'],
        ['currencyCode', 'String', "'USD'", 'Used when format is currency.'],
        ['trend / trendLabel', 'Number / String', '—', 'A delta such as 4.2 or -3, and its caption. Omit trend to hide the row.'],
        ['iconName', 'String', '—', 'e.g. utility:opportunity'],
        ['variant', 'String', "'base'", 'base, success, warning or error.']
      ]
    },
    {
      id: 'date-range-picker',
      name: 'c-date-range-picker',
      category: 'UX components',
      kind: 'LWC',
      path: 'lwc/dateRangePicker',
      tagline: 'Two date inputs with quick-range presets, validated, emitting ISO dates ready for a QueryFilter.',
      usage:
        '<c-date-range-picker label="Created Date" onchange={handleRangeChange}></c-date-range-picker>',
      api: [
        ['label', 'String', "'Date Range'", ''],
        ['startDate / endDate', 'String', "''", 'Settable ISO date strings.'],
        ['required', 'Boolean', 'false', ''],
        ['hidePresets', 'Boolean', 'false', 'Hide the quick-range buttons.']
      ],
      events: [['change', '{ startDate, endDate }', 'On every valid edit. Not fired while start is after end.']]
    },
    {
      id: 'function-utils',
      name: 'functionUtils',
      category: 'Data utilities',
      kind: 'JS module',
      path: 'lwc/functionUtils',
      tagline: 'Debounce and throttle for search-as-you-type, scroll, and resize handlers.',
      usage: "import { debounce, throttle } from 'c/functionUtils';\n\nconst debounced = debounce(() => this.runSearch(), 300);",
      functions: [
        ['debounce(fn, waitMs = 300)', 'Delays fn until waitMs pass with no further calls. Returned fn has .cancel().'],
        ['throttle(fn, waitMs = 300)', 'Calls fn at most once per waitMs (leading + trailing edge).']
      ]
    },
    {
      id: 'object-utils',
      name: 'objectUtils',
      category: 'Data utilities',
      kind: 'JS module',
      path: 'lwc/objectUtils',
      tagline: 'Deep clone, deep equality, and safe nested-path access for plain data.',
      usage: "import { deepClone, isEqual, getNestedValue, setNestedValue } from 'c/objectUtils';",
      functions: [
        ['deepClone(value)', 'Recursively clones objects/arrays/Date/Map/Set.'],
        ['isEqual(a, b)', 'Deep equality for objects, arrays, Dates, primitives.'],
        ['getNestedValue(obj, path, defaultValue?)', "Reads 'a.b[0].c' without throwing on a missing segment."],
        ['setNestedValue(obj, path, value)', 'Returns a new object with value set at path (immutable).']
      ]
    },
    {
      id: 'csv-utils',
      name: 'csvUtils',
      category: 'Data utilities',
      kind: 'JS module',
      path: 'lwc/csvUtils',
      tagline: 'RFC 4180 CSV build + browser download for datatable / bulk-action exports.',
      usage:
        "import { exportRowsToCsv } from 'c/csvUtils';\n\nexportRowsToCsv(selectedRows, this.columns, 'accounts-export.csv');",
      functions: [
        ['escapeCsvValue(value)', 'Quotes fields that contain commas, quotes, or newlines; Dates become ISO strings, arrays join with "; ".'],
        ['neutralizeFormula(value)', "Prefixes text starting with = + - @ with a quote so spreadsheets don't run it as a formula."],
        ['rowsToCsv(rows, columns, options?)', 'CRLF-separated CSV from rows + datatable-style columns; skips action columns, reads nested relationships.'],
        ['downloadCsv(filename, csvContent)', 'Triggers a browser download, with a UTF-8 BOM so Excel reads non-ASCII text.'],
        ['exportRowsToCsv(rows, columns, filename?, options?)', 'rowsToCsv + downloadCsv; returns the CSV content.'],
        ['parseCsv(text)', 'RFC 4180 parser: quoted fields, embedded commas and newlines, CRLF or LF, a leading BOM. Blank lines are dropped; an unclosed quote throws.'],
        ['parseCsvTable(text)', '{ headers, rows } - the first record is the header row.']
      ]
    },
    {
      id: 'csv-import-engine',
      name: 'csvImportEngine',
      category: 'Data utilities',
      kind: 'JS module',
      path: 'lwc/csvImportEngine',
      tagline: 'The UI-free logic behind the import wizard: map headers to fields, convert cells to typed values, validate every row.',
      usage:
        "import { autoMapColumns, validateMapping, buildRecords } from 'c/csvImportEngine';\nimport { parseCsvTable } from 'c/csvUtils';\n\nconst { headers, rows } = parseCsvTable(text);\nconst mapping = autoMapColumns(headers, fields);\nconst { records, errors } = buildRecords({ rows, mapping, fields });",
      functions: [
        ['autoMapColumns(headers, fields)', 'Matches headers to field API names or labels, ignoring case and punctuation; a header of "Id" maps to the record Id. One API name per header, \'\' where nothing matched.'],
        ['validateMapping(mapping, fields)', 'Messages for what blocks an import: nothing mapped, two columns mapped to one field, or a required field with no column (not checked when an Id column is mapped).'],
        ['coerceValue(raw, type)', 'Returns { skip }, { value } or { error }. Empty cells are skipped, never sent as blanks.'],
        ['buildRecords({ rows, mapping, fields })', '{ records, errors, invalidRowCount, emptyRowCount }; row numbers count the header as row 1. Required fields are only enforced on rows without an Id.']
      ]
    },
    {
      id: 'json-utils',
      name: 'jsonUtils',
      category: 'Data utilities',
      kind: 'JS module',
      path: 'lwc/jsonUtils',
      tagline: "JSON helpers that don't throw - handy for debug panels and malformed payloads.",
      usage: "import { safeParse, safeStringify, prettyPrint, isValidJson } from 'c/jsonUtils';",
      functions: [
        ['safeParse(jsonString, fallback = null)', 'JSON.parse that returns fallback instead of throwing.'],
        ['safeStringify(value, fallback = "", indent?)', 'JSON.stringify that returns fallback instead of throwing.'],
        ['prettyPrint(value, indent = 2)', "Accepts a JSON string or JS value; returns indented JSON."],
        ['isValidJson(value)', 'Boolean check.']
      ]
    },
    {
      id: 'url-utils',
      name: 'urlUtils',
      category: 'Data utilities',
      kind: 'JS module',
      path: 'lwc/urlUtils',
      tagline: 'Query-string parse/build/read/update helpers built on URLSearchParams/URL.',
      usage: "import { parseQueryParams, buildQueryString, withQueryParam } from 'c/urlUtils';",
      functions: [
        ['parseQueryParams(search?)', 'Repeated keys become arrays.'],
        ['buildQueryString(params)', "Returns '?a=1&b=2' or ''."],
        ['getQueryParam(name, search?)', 'Reads a single param.'],
        ['withQueryParam(url, name, value)', 'Returns a new URL string with name set.'],
        ['removeQueryParam(url, name)', 'Returns a new URL string with name removed.']
      ]
    },
    {
      id: 'apex-error-utils',
      name: 'apexErrorUtils',
      category: 'Salesforce utilities',
      kind: 'JS module',
      path: 'lwc/apexErrorUtils',
      tagline: 'Turns errors from an imperative @salesforce/apex call (or @wire to Apex) into plain messages.',
      usage: "import { reduceApexErrors } from 'c/apexErrorUtils';\n\ntry {\n    await saveRecords({ objectApiName, records });\n} catch (error) {\n    const messages = reduceApexErrors(error);\n}",
      functions: [
        ['reduceApexErrors(errors)', "String[] - de-duplicated messages, worst case ['Unknown error']."],
        ['reduceApexErrorMessage(errors, separator = ", ")', 'Joined string.']
      ]
    },
    {
      id: 'lds-error-utils',
      name: 'ldsErrorUtils',
      category: 'Salesforce utilities',
      kind: 'JS module',
      path: 'lwc/ldsErrorUtils',
      tagline: 'Same idea as apexErrorUtils, for Lightning Data Service / UI API errors (different shape).',
      usage: "import { reduceLdsErrors } from 'c/ldsErrorUtils';",
      functions: [
        ['reduceLdsErrors(errors)', 'String[] from getRecord/createRecord/updateRecord/deleteRecord failures.'],
        ['reduceLdsErrorMessage(errors, separator = ", ")', 'Joined string.']
      ]
    },
    {
      id: 'navigation-utils',
      name: 'navigationUtils',
      category: 'Salesforce utilities',
      kind: 'JS module',
      path: 'lwc/navigationUtils',
      tagline: 'NavigationMixin boilerplate wrapped in plain functions - pass the component as the first argument.',
      usage:
        "import { NavigationMixin } from 'lightning/navigation';\nimport { navigateToRecord } from 'c/navigationUtils';\n\nexport default class MyCmp extends NavigationMixin(LightningElement) {\n    openAccount(id) {\n        navigateToRecord(this, id, 'Account');\n    }\n}",
      functions: [
        ['navigateToRecord(cmp, recordId, objectApiName, actionName?)', ''],
        ['navigateToNewRecord(cmp, objectApiName, defaultFieldValues?)', ''],
        ['navigateToObjectHome(cmp, objectApiName)', ''],
        ['navigateToListView(cmp, objectApiName, listViewApiName)', ''],
        ['navigateToRelatedList(cmp, recordId, objectApiName, relationshipApiName)', ''],
        ['generateRecordUrl(cmp, recordId, objectApiName, actionName?)', 'Promise<String> href, no navigation.']
      ]
    },
    {
      id: 'record-utils',
      name: 'recordUtils',
      category: 'Salesforce utilities',
      kind: 'JS module',
      path: 'lwc/recordUtils',
      tagline: 'Pairs refreshApex with notifyRecordUpdateAvailable in one call after a DML that bypassed LDS.',
      usage: "import { refreshRecords } from 'c/recordUtils';\n\nawait refreshRecords(this.wiredAccounts, savedRecordIds);",
      functions: [
        ['refreshRecords(wiredResult?, recordIds?)', 'Runs refreshApex and/or notifyRecordsChanged.'],
        ['notifyRecordsChanged(recordIds)', 'Accepts a single Id, an array, or {recordId} objects.'],
        ['normalizeRecordIds(recordIds)', 'The shape-normalizer, exported directly.']
      ]
    },
    {
      id: 'permission-utils',
      name: 'permissionUtils',
      category: 'Salesforce utilities',
      kind: 'JS module',
      path: 'lwc/permissionUtils',
      tagline: 'Session-memoized client wrapper over PermissionService.cls.',
      usage: "import { getObjectAccess, hasCustomPermission } from 'c/permissionUtils';\n\nconst access = await getObjectAccess('Account');\nconst canBulkEdit = await hasCustomPermission('Toolkit_Bulk_Edit');",
      functions: [
        ['getObjectAccess(objectApiName)', 'Promise<{isAccessible, isCreateable, isUpdateable, isDeletable}>'],
        ['getFieldAccess(objectApiName, fieldNames)', 'Promise<Array<{fieldName, readable, editable}>>'],
        ['hasCustomPermission(developerName)', 'Promise<Boolean>'],
        ['clearPermissionCache()', 'Clears every cached result.']
      ]
    },
    {
      id: 'metadata-utils',
      name: 'metadataUtils',
      category: 'Salesforce utilities',
      kind: 'JS module',
      path: 'lwc/metadataUtils',
      tagline: 'Session-cached client wrapper over CustomMetadataService.cls.',
      usage: "import { getMetadataRecordByDeveloperName } from 'c/metadataUtils';\n\nconst record = await getMetadataRecordByDeveloperName('ToolkitDemoSetting__mdt', 'Default', ['DefaultPageSize__c']);",
      functions: [
        ['getMetadataRecords(metadataApiName, fieldNames = [])', 'Promise<Array<Object>>'],
        ['getMetadataRecordByDeveloperName(metadataApiName, developerName, fieldNames = [])', 'Promise<Object|null>'],
        ['clearMetadataCache()', '']
      ]
    },
    {
      id: 'toast-service',
      name: 'toastService',
      category: 'Salesforce utilities',
      kind: 'JS module',
      path: 'lwc/toastService',
      tagline: 'Consistent ShowToastEvent dispatch with de-duplication (suppresses an identical toast fired twice within 3s).',
      usage: "import { showSuccessToast, showErrorToast } from 'c/toastService';\n\nshowSuccessToast(this, 'Record saved.');\nshowErrorToast(this, reduceApexErrors(error));",
      functions: [
        ['showToast(cmp, { title, message, variant, mode, allowDuplicate })', ''],
        ['showSuccessToast(cmp, message, title?)', ''],
        ['showErrorToast(cmp, messageOrMessages, title?)', 'Accepts a string or string[].'],
        ['clearToastDedupeState()', '']
      ]
    },
    {
      id: 'lms-utils',
      name: 'lmsUtils',
      category: 'Salesforce utilities',
      kind: 'JS module',
      path: 'lwc/lmsUtils',
      tagline: 'Thin Lightning Message Service wrapper with a controller that cannot double-subscribe. Ships a ready channel.',
      usage:
        "import { createChannelController } from 'c/lmsUtils';\n\nthis.channel = createChannelController(this.messageContext, TOOLKIT_CHANNEL);\nthis.channel.subscribe((message) => this.handleMessage(message));\nthis.channel.publish({ recordId });",
      functions: [
        ['publishMessage(messageContext, channel, payload)', ''],
        ['subscribeToChannel(messageContext, channel, callback, options?)', 'Returns the subscription.'],
        ['unsubscribeFromChannel(subscription)', 'Safe to call with a falsy subscription.'],
        ['createChannelController(messageContext, channel)', '{ publish, subscribe, unsubscribe }; a second subscribe() replaces the first.']
      ]
    },
    {
      id: 'emp-utils',
      name: 'empUtils',
      category: 'Salesforce utilities',
      kind: 'JS module',
      path: 'lwc/empUtils',
      tagline: 'Subscribe to Change Data Capture for an object without handling channel names and event envelopes.',
      usage:
        "import { subscribeToObjectChanges } from 'c/empUtils';\n\nthis.stopWatching = await subscribeToObjectChanges('Account', (change) => {\n    // change.changeType, change.recordIds, change.commitUser\n    this.reload();\n});\n\ndisconnectedCallback() { if (this.stopWatching) this.stopWatching(); }",
      functions: [
        ['getChangeEventChannel(objectApiName)', 'Account -> /data/AccountChangeEvent; Invoice__c -> /data/Invoice__ChangeEvent.'],
        ['normalizeChangeEvent(message)', '{ changeType, entityName, recordIds, commitUser, raw } from the platform envelope.'],
        ['subscribeToObjectChanges(objectApiName, onChange)', 'New events only (no replay). Resolves to an idempotent unsubscribe function; rejects if the channel cannot be subscribed, e.g. Change Data Capture is not enabled for the object.']
      ]
    },
    {
      id: 'generic-query-service',
      name: 'GenericQueryService.cls',
      category: 'Apex services',
      kind: 'Apex',
      path: 'classes/GenericQueryService.cls',
      tagline: 'Schema-driven dynamic SOQL: pagination, sorting, filtering, and search for any object - no bespoke controller.',
      usage:
        '@AuraEnabled(cacheable=true)\npublic static QueryResult query(\n    String objectApiName, List<String> fields, List<QueryFilter> filters,\n    String sortField, String sortDirection, String searchTerm, List<String> searchFields,\n    Integer pageNumber, Integer pageSize\n)',
      methods: [
        ['Returns', 'QueryResult', '{ records, totalCount, pageNumber, pageSize, hasMore }'],
        ['queryWithCursor', 'CursorQueryResult', 'Keyset pagination, always Id ASC: { records, hasMore, nextCursor }. Cheap at any depth, but no total count or jump-to-page.'],
        ['Relationship paths', '—', "Owner.Name style paths are validated hop by hop, resolving relationship names (Owner) to their lookup fields (OwnerId)."],
        ['Security', '—', 'Identifiers validated against schema describes; values bound via Database.queryWithBinds; runs under AccessLevel.USER_MODE.']
      ]
    },
    {
      id: 'generic-dml-service',
      name: 'GenericDmlService.cls',
      category: 'Apex services',
      kind: 'Apex',
      path: 'classes/GenericDmlService.cls',
      tagline: 'Bulk insert/update/delete with allOrNone=false and a per-row result, so one bad row never blocks the batch.',
      usage:
        '@AuraEnabled\npublic static List<DmlResult> saveRecords(String objectApiName, List<DmlRecordInput> records)\n\n@AuraEnabled\npublic static List<DmlResult> deleteRecords(String objectApiName, List<String> recordIds)',
      methods: [
        ['DmlRecordInput', '{ rowKey, fields, expectedModstamp }', 'fields is a map of API name to value; include Id to update, omit to insert. expectedModstamp (epoch ms of the SystemModstamp you loaded) makes an update fail instead of overwriting a newer change.'],
        ['DmlResult', '{ rowKey, recordId, success, message, fieldNames, isConflict, modstamp }', 'One per input row. isConflict marks a rejected stale edit; modstamp is the new stamp after a successful checked update.'],
        ['Conflict check', '—', 'Compare-then-write, not a lock: it narrows the window rather than closing it. Skipped for objects without SystemModstamp.'],
        ['Security', '—', 'FLS enforced via Security.stripInaccessible before every insert/update.']
      ]
    },
    {
      id: 'generic-aggregate-service',
      name: 'GenericAggregateService.cls',
      category: 'Apex services',
      kind: 'Apex',
      path: 'classes/GenericAggregateService.cls',
      tagline: 'COUNT / SUM / AVG / MIN / MAX with optional GROUP BY for any object, with the same safety model as the query service.',
      usage:
        '@AuraEnabled(cacheable=true)\npublic static List<AggregateRow> aggregate(\n    String objectApiName, List<AggregateSpec> aggregates, List<String> groupByFields,\n    List<QueryFilter> filters, Integer maxGroups\n)\n\n// AggregateSpec { functionName, fieldName, alias }\n// AggregateRow  { groups: Map<field, value>, values: Map<alias, value> }',
      methods: [
        ['Grouping', '—', 'Up to 3 group-by fields (relationship paths allowed), ordered by them; maxGroups defaults to 50 and is capped at 200.'],
        ['Strictness', '—', 'An unknown or unreadable field, a SUM/AVG on a non-numeric field, or a bad alias is an error, not a silent drop - dropping it would return a different number than asked for.'],
        ['Security', '—', 'Identifiers validated against schema describes; aliases only ever used as map keys; filter values bound; runs under AccessLevel.USER_MODE.']
      ]
    },
    {
      id: 'saved-view-service-apex',
      name: 'SavedViewService.cls',
      category: 'Apex services',
      kind: 'Apex',
      path: 'classes/SavedViewService.cls',
      tagline: 'Per-user saved views for datatables, stored in the Private ToolkitSavedView__c object.',
      usage:
        '@AuraEnabled public static List<SavedViewInfo> getViews(String viewKey)\n@AuraEnabled public static SavedViewInfo saveView(\n    String viewKey, String objectApiName, String name, String config, Boolean makeDefault, Id viewId)\n@AuraEnabled public static List<SavedViewInfo> setDefaultView(String viewKey, Id viewId)\n@AuraEnabled public static void deleteView(Id viewId)',
      methods: [
        ['saveView', 'SavedViewInfo', 'With a viewId it updates (and may rename) that view; without one, a view with the same name is replaced, else a new one is created. makeDefault null keeps the flag.'],
        ['Limits', '—', '50 views per user and table; names up to 80 characters; the config must be a JSON object under 30,000 characters.'],
        ['Security', '—', 'Every query filters on the running user as well as running in user mode, so View All Data does not expose another user\'s views.']
      ]
    },
    {
      id: 'permission-service-apex',
      name: 'PermissionService.cls',
      category: 'Apex services',
      kind: 'Apex',
      path: 'classes/PermissionService.cls',
      tagline: "Object/field/custom-permission checks, backing permissionUtils.js.",
      usage:
        '@AuraEnabled(cacheable=true)\npublic static Map<String, Boolean> checkObjectAccess(String objectApiName)\n\n@AuraEnabled(cacheable=true)\npublic static Boolean hasCustomPermission(String developerName)',
      methods: [
        ['hasCustomPermission', 'Boolean', 'Checks both Permission Set/Group assignments and permissions granted directly on the Profile.']
      ]
    },
    {
      id: 'custom-metadata-service-apex',
      name: 'CustomMetadataService.cls',
      category: 'Apex services',
      kind: 'Apex',
      path: 'classes/CustomMetadataService.cls',
      tagline: 'Generic Custom Metadata Type reader, backing metadataUtils.js.',
      usage:
        '@AuraEnabled(cacheable=true)\npublic static List<SObject> getRecords(String metadataApiName, List<String> fieldNames)',
      methods: [['Validation', '—', 'metadataApiName must end in __mdt; unknown/inaccessible fields are silently dropped.']]
    },
    {
      id: 'file-manager-service-apex',
      name: 'FileManagerService.cls',
      category: 'Apex services',
      kind: 'Apex',
      path: 'classes/FileManagerService.cls',
      tagline: 'List and delete the files attached to a record, backing c-file-upload-manager.',
      usage:
        '@AuraEnabled(cacheable=true)\npublic static List<FileInfo> getFilesForRecord(Id recordId)\n\n@AuraEnabled\npublic static void deleteFile(Id contentDocumentId)',
      methods: [
        ['FileInfo', '{ contentDocumentId, latestVersionId, title, fileExtension, contentSize, createdDate }', 'One per attached file.'],
        ['Security', '—', 'Reads and deletes under AccessLevel.USER_MODE; uploading is handled by lightning-file-upload.']
      ]
    },
  ];
});
