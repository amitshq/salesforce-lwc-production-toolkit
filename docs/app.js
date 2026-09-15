/* Vanilla JS. No build step, no dependencies - this is a static GitHub Pages site. */

/* =========================================================================
   1. THEME TOGGLE
   ========================================================================= */
(function themeToggle() {
  const root = document.documentElement;
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') {
    root.setAttribute('data-theme', stored);
  }

  function currentTheme() {
    if (root.getAttribute('data-theme')) return root.getAttribute('data-theme');
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateButton(btn) {
    const isDark = currentTheme() === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  updateButton(btn);
  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateButton(btn);
  });
})();

/* =========================================================================
   2. SCROLLSPY - highlight the current section's nav link
   ========================================================================= */
(function scrollspy() {
  const links = Array.from(document.querySelectorAll('.nav .links a[href^="#"]'));
  if (!links.length) return;
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = links.find((l) => l.getAttribute('href') === `#${entry.target.id}`);
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    },
    { rootMargin: '-40% 0px -50% 0px' }
  );
  sections.forEach((section) => observer.observe(section));
})();

/* =========================================================================
   3. COPY-TO-CLIPBOARD on every code block
   ========================================================================= */
function wrapCodeBlocksWithCopyButtons(scope) {
  scope.querySelectorAll('pre').forEach((pre) => {
    if (pre.closest('.code-block')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-btn';
    button.textContent = 'Copy';
    button.addEventListener('click', () => {
      const text = pre.textContent;
      navigator.clipboard
        .writeText(text)
        .then(() => {
          button.textContent = 'Copied!';
          button.classList.add('copied');
          setTimeout(() => {
            button.textContent = 'Copy';
            button.classList.remove('copied');
          }, 1500);
        })
        .catch(() => {
          button.textContent = 'Press Ctrl+C';
        });
    });
    wrapper.appendChild(button);
  });
}
wrapCodeBlocksWithCopyButtons(document);

/* =========================================================================
   4. COMPONENT / UTILITY / APEX CATALOG
   ========================================================================= */
const CATALOG = [
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
      ['enableBulkDelete', 'Boolean', 'false', "Built-in 'Delete' bulk action, gated on CRUD + confirmation."]
    ],
    events: [['bulkaction', '{ name, selectedRows }', 'A bulkActions entry (not the built-in delete) was clicked.']],
    methods: [['refresh()', 'Promise<void>', 'Re-runs the current query; clears selection/in-progress edits.']]
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
      ['DmlRecordInput', '{ rowKey, fields }', 'fields is a map of API name to value; include Id to update, omit to insert.'],
      ['DmlResult', '{ rowKey, recordId, success, message, fieldNames }', 'One per input row.'],
      ['Security', '—', 'FLS enforced via Security.stripInaccessible before every insert/update.']
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
  }
];

/* ---- render the catalog grid ---- */
const grid = document.getElementById('catalogGrid');
const emptyMsg = document.getElementById('catalogEmpty');
const searchInput = document.getElementById('catalogSearch');
const pills = document.querySelectorAll('#filterPills .pill');
let activeFilter = 'all';

function cardHtml(item) {
  return (
    `<button type="button" class="card catalog-card" data-id="${item.id}">` +
    `<span class="kind-badge">${item.kind}</span>` +
    `<h3>${item.name}</h3>` +
    `<p>${item.tagline}</p>` +
    `<code class="path">${item.path}</code>` +
    `</button>`
  );
}

function renderCatalog() {
  const term = (searchInput.value || '').toLowerCase().trim();
  const filtered = CATALOG.filter((item) => {
    const matchesFilter = activeFilter === 'all' || item.category === activeFilter;
    const haystack = `${item.name} ${item.tagline} ${item.category} ${item.path}`.toLowerCase();
    const matchesSearch = !term || haystack.includes(term);
    return matchesFilter && matchesSearch;
  });
  grid.innerHTML = filtered.map(cardHtml).join('');
  emptyMsg.hidden = filtered.length !== 0;
}

pills.forEach((pill) => {
  pill.addEventListener('click', () => {
    pills.forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    activeFilter = pill.dataset.filter;
    renderCatalog();
  });
});
searchInput.addEventListener('input', renderCatalog);
renderCatalog();

/* ---- catalog detail modal ---- */
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');
let lastFocusedBeforeModal = null;

function rowsToTable(headers, rows) {
  if (!rows || !rows.length) return '';
  const head = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c === '' ? '&mdash;' : c}</td>`).join('')}</tr>`).join('');
  return `<table>${head}${body}</table>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openCatalogModal(id) {
  const item = CATALOG.find((c) => c.id === id);
  if (!item) return;
  let html = `<span class="modal-kind">${item.kind} &middot; ${item.category}</span>`;
  html += `<h3 id="modalTitle">${item.name}</h3>`;
  html += `<p class="modal-tagline">${item.tagline}</p>`;
  html += `<h4>Usage</h4><div class="code-block"><pre><code>${escapeHtml(item.usage)}</code></pre></div>`;
  if (item.api) {
    html += `<h4>Properties</h4>${rowsToTable(['Property', 'Type', 'Default', 'Description'], item.api)}`;
  }
  if (item.functions) {
    html += `<h4>Functions</h4>${rowsToTable(['Signature', 'Description'], item.functions)}`;
  }
  if (item.methods) {
    html += `<h4>Methods</h4>${rowsToTable(['Method', 'Returns', 'Description'], item.methods)}`;
  }
  if (item.events) {
    html += `<h4>Events</h4>${rowsToTable(['Event', 'Detail', 'When'], item.events)}`;
  }
  html += `<h4>File</h4><code class="path">${item.path}</code>`;
  modalContent.innerHTML = html;
  wrapCodeBlocksWithCopyButtons(modalContent);

  lastFocusedBeforeModal = document.activeElement;
  modalOverlay.hidden = false;
  modalClose.focus();
  document.addEventListener('keydown', handleModalKeydown);
}

function closeCatalogModal() {
  modalOverlay.hidden = true;
  document.removeEventListener('keydown', handleModalKeydown);
  if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
    lastFocusedBeforeModal.focus();
  }
}

function handleModalKeydown(event) {
  if (event.key === 'Escape') closeCatalogModal();
}

grid.addEventListener('click', (event) => {
  const card = event.target.closest('.catalog-card');
  if (card) openCatalogModal(card.dataset.id);
});
modalClose.addEventListener('click', closeCatalogModal);
modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) closeCatalogModal();
});

/* =========================================================================
   5. TOAST HELPER (mirrors c/toastService for the live demo)
   ========================================================================= */
const toastStack = document.getElementById('toastStack');
function showToast(message, variant) {
  const toast = document.createElement('div');
  toast.className = `toast ${variant || 'info'}`;
  toast.textContent = message;
  toastStack.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/* =========================================================================
   6. MOCK CONFIRM DIALOG (mirrors c/confirmDialog for the live demo)
   ========================================================================= */
function mockConfirm({ label, message, confirmLabel, destructive }) {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.innerHTML =
      `<h3 id="modalTitle">${escapeHtml(label)}</h3>` +
      `<p class="modal-tagline">${escapeHtml(message)}</p>` +
      `<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">` +
      `<button type="button" class="btn secondary" data-action="cancel">Cancel</button>` +
      `<button type="button" class="btn ${destructive ? '' : 'primary'}" data-action="confirm" ${destructive ? 'style="background:var(--danger);color:#fff;border-color:transparent;"' : ''}>${escapeHtml(confirmLabel || 'Confirm')}</button>` +
      `</div>`;
    modalContent.innerHTML = '';
    modalContent.appendChild(box);
    lastFocusedBeforeModal = document.activeElement;
    modalOverlay.hidden = false;

    function cleanup(result) {
      modalOverlay.hidden = true;
      box.removeEventListener('click', onClick);
      if (lastFocusedBeforeModal) lastFocusedBeforeModal.focus();
      resolve(result);
    }
    function onClick(event) {
      const action = event.target.dataset.action;
      if (action === 'confirm') cleanup(true);
      if (action === 'cancel') cleanup(false);
    }
    box.addEventListener('click', onClick);
  });
}

/* =========================================================================
   7. LIVE DEMO - a fully client-side mock of the enterpriseDatatable pipeline
   ========================================================================= */
(function liveDemo() {
  const ORIGINAL_ROWS = [
    { id: '1', name: 'Acme Corporation', industry: 'Manufacturing', revenue: 4200000, owner: 'J. Reyes' },
    { id: '2', name: 'Globex Industries', industry: 'Manufacturing', revenue: 1850000, owner: 'A. Chen' },
    { id: '3', name: 'Initech Software', industry: 'Technology', revenue: 980000, owner: 'M. Patel' },
    { id: '4', name: 'Umbrella Health', industry: 'Healthcare', revenue: 6750000, owner: 'J. Reyes' },
    { id: '5', name: 'Stark Energy', industry: 'Energy', revenue: 12500000, owner: 'A. Chen' },
    { id: '6', name: 'Wayne Logistics', industry: 'Transportation', revenue: 3100000, owner: 'M. Patel' },
    { id: '7', name: 'Hooli Cloud', industry: 'Technology', revenue: 2200000, owner: 'J. Reyes' },
    { id: '8', name: 'Soylent Foods', industry: 'Consumer Goods', revenue: 890000, owner: 'A. Chen' },
    { id: '9', name: 'Massive Dynamic', industry: 'Technology', revenue: 15300000, owner: 'M. Patel' },
    { id: '10', name: 'Cyberdyne Systems', industry: 'Technology', revenue: 5400000, owner: 'J. Reyes' },
    { id: '11', name: 'Aperture Labs', industry: 'Research', revenue: 720000, owner: 'A. Chen' },
    { id: '12', name: 'Oscorp Chemicals', industry: 'Manufacturing', revenue: 3950000, owner: 'M. Patel' },
    { id: '13', name: 'Tyrell BioTech', industry: 'Healthcare', revenue: 8100000, owner: 'J. Reyes' }
  ];
  const ALWAYS_FAILS_ID = '2'; // "Globex Industries" - simulates a server-side validation failure
  const PAGE_SIZE = 5;
  const COLUMNS = [
    { field: 'name', label: 'Account Name', editable: true },
    { field: 'industry', label: 'Industry', editable: true },
    { field: 'revenue', label: 'Annual Revenue', editable: false, format: 'currency' },
    { field: 'owner', label: 'Owner', editable: false }
  ];

  let rows = ORIGINAL_ROWS.map((r) => ({ ...r }));
  let sortField = 'name';
  let sortDir = 'asc';
  let searchTerm = '';
  let page = 1;
  let selected = new Set();
  let rowErrors = {}; // id -> message
  let searchDebounce;

  const headRow = document.getElementById('demoHeadRow');
  const body = document.getElementById('demoBody');
  const bulkBar = document.getElementById('demoBulkBar');
  const pageStatus = document.getElementById('demoPageStatus');
  const prevBtn = document.getElementById('demoPrev');
  const nextBtn = document.getElementById('demoNext');
  const searchBox = document.getElementById('demoSearch');
  const refreshBtn = document.getElementById('demoRefresh');

  function currencyFormat(value) {
    return '$' + Number(value).toLocaleString('en-US');
  }

  function getFiltered() {
    const term = searchTerm.toLowerCase();
    let list = rows.filter(
      (r) => !term || r.name.toLowerCase().includes(term) || r.industry.toLowerCase().includes(term)
    );
    list.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      let cmp;
      if (typeof av === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }

  function renderHead() {
    headRow.innerHTML =
      '<th style="width:34px"></th>' +
      COLUMNS.map((col) => {
        const arrow = sortField === col.field ? `<span class="sort-arrow">${sortDir === 'asc' ? '▲' : '▼'}</span>` : '';
        return `<th data-field="${col.field}">${col.label}${arrow}</th>`;
      }).join('');
  }

  function render() {
    renderHead();
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    body.innerHTML = pageRows
      .map((row) => {
        const isSelected = selected.has(row.id);
        const error = rowErrors[row.id];
        const cells = COLUMNS.map((col) => {
          const raw = row[col.field];
          const display = col.format === 'currency' ? currencyFormat(raw) : escapeHtml(String(raw));
          const editableClass = col.editable ? 'editable-cell' : '';
          return `<td class="${editableClass}" data-id="${row.id}" data-field="${col.field}" ${col.editable ? 'data-editable="true"' : ''}>${display}</td>`;
        }).join('');
        const errorRow = error
          ? `<tr class="row-error"><td></td><td colspan="${COLUMNS.length}"><span class="row-error-msg">⚠ Save failed: ${escapeHtml(error)}</span></td></tr>`
          : '';
        return (
          `<tr class="${isSelected ? 'row-selected' : ''}" data-row-id="${row.id}">` +
          `<td><input type="checkbox" data-select="${row.id}" ${isSelected ? 'checked' : ''} aria-label="Select ${escapeHtml(row.name)}" /></td>` +
          cells +
          `</tr>${errorRow}`
        );
      })
      .join('');

    pageStatus.textContent = `Page ${page} of ${totalPages} • ${filtered.length} record${filtered.length === 1 ? '' : 's'}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;

    if (selected.size > 0) {
      bulkBar.hidden = false;
      bulkBar.innerHTML =
        `<span>${selected.size} selected</span>` +
        `<div style="display:flex;gap:8px;">` +
        `<button type="button" class="btn secondary small" id="demoClearSelection">Clear</button>` +
        `<button type="button" class="btn small" id="demoBulkDelete" style="background:var(--danger);color:#fff;border-color:transparent;">Delete selected</button>` +
        `</div>`;
      document.getElementById('demoClearSelection').addEventListener('click', () => {
        selected.clear();
        render();
      });
      document.getElementById('demoBulkDelete').addEventListener('click', handleBulkDelete);
    } else {
      bulkBar.hidden = true;
      bulkBar.innerHTML = '';
    }
  }

  async function handleBulkDelete() {
    const count = selected.size;
    const confirmed = await mockConfirm({
      label: 'Delete Records',
      message: `This will permanently delete ${count} record${count === 1 ? '' : 's'}. This cannot be undone. (This is a mock - GenericDmlService.deleteRecords does the real thing.)`,
      confirmLabel: 'Delete',
      destructive: true
    });
    if (!confirmed) return;
    rows = rows.filter((r) => !selected.has(r.id));
    showToast(`${count} record${count === 1 ? '' : 's'} deleted.`, 'success');
    selected.clear();
    render();
  }

  function commitEdit(id, field, value) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    row[field] = value;

    if (id === ALWAYS_FAILS_ID) {
      rowErrors[id] = 'Duplicate account name detected.';
      showToast('1 saved, 1 failed. See the row for details.', 'error');
    } else {
      delete rowErrors[id];
      showToast('Record saved.', 'success');
    }
    render();
  }

  headRow.addEventListener('click', (event) => {
    const th = event.target.closest('th[data-field]');
    if (!th) return;
    const field = th.dataset.field;
    if (sortField === field) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDir = 'asc';
    }
    render();
  });

  body.addEventListener('change', (event) => {
    if (event.target.matches('[data-select]')) {
      const id = event.target.dataset.select;
      if (event.target.checked) selected.add(id);
      else selected.delete(id);
      render();
    }
  });

  body.addEventListener('dblclick', (event) => {
    const cell = event.target.closest('td[data-editable="true"]');
    if (!cell || cell.querySelector('input')) return;
    const id = cell.dataset.id;
    const field = cell.dataset.field;
    const row = rows.find((r) => r.id === id);
    const originalValue = row[field];
    cell.innerHTML = `<input type="text" value="${escapeHtml(String(originalValue))}" />`;
    const input = cell.querySelector('input');
    input.focus();
    input.select();

    function finish(commit) {
      const newValue = input.value;
      if (commit && newValue !== String(originalValue)) {
        commitEdit(id, field, newValue);
      } else {
        render();
      }
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
  });

  prevBtn.addEventListener('click', () => {
    page -= 1;
    render();
  });
  nextBtn.addEventListener('click', () => {
    page += 1;
    render();
  });
  searchBox.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchTerm = searchBox.value;
      page = 1;
      render();
    }, 250);
  });
  refreshBtn.addEventListener('click', () => {
    rows = ORIGINAL_ROWS.map((r) => ({ ...r }));
    rowErrors = {};
    selected.clear();
    searchTerm = '';
    searchBox.value = '';
    page = 1;
    showToast('Refreshed.', 'info');
    render();
  });

  render();
})();

/* =========================================================================
   8. FIX UP DEEP-LINK SCROLL POSITION
   Content above the target (the catalog grid, the demo table) is populated
   by the scripts above, after the browser already resolved any #hash in the
   URL against the pre-render (near-empty) layout. Re-scroll once everything
   has its final height.
   ========================================================================= */
if (window.location.hash) {
  const target = document.querySelector(window.location.hash);
  if (target) {
    requestAnimationFrame(() => target.scrollIntoView());
  }
}
