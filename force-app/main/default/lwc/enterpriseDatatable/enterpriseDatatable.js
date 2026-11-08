import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import LOCALE from '@salesforce/i18n/locale';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import queryRecords from '@salesforce/apex/GenericQueryService.query';
import queryBatch from '@salesforce/apex/GenericQueryService.queryBatch';
import queryPage from '@salesforce/apex/CursorPagingService.queryPage';
import saveRecords from '@salesforce/apex/GenericDmlService.saveRecords';
import deleteRecords from '@salesforce/apex/GenericDmlService.deleteRecords';
import undeleteRecords from '@salesforce/apex/GenericDmlService.undeleteRecords';
import summarize from '@salesforce/apex/GenericAggregateService.summarize';
import { reduceApexErrors } from 'c/apexErrorUtils';
import { showSuccessToast, showErrorToast } from 'c/toastService';
import { debounce } from 'c/functionUtils';
import { getNestedValue } from 'c/objectUtils';
import { getObjectAccess } from 'c/permissionUtils';
import { notifyRecordsChanged } from 'c/recordUtils';
import { subscribeToObjectChanges } from 'c/empUtils';
import { navigateToRecord } from 'c/navigationUtils';
import { rowsToCsv, downloadCsv } from 'c/csvUtils';
import {
    DEFAULT_RECORD_URL_TEMPLATE,
    normalizeRowActions,
    recordUrl,
    relatedIdPath,
    toChunks,
    sortRows,
    richTextToPlainText,
    formatNumber
} from 'c/datatableHelpers';
import ConfirmDialog from 'c/confirmDialog';
import MassUpdateDialog from 'c/massUpdateDialog';

const DEFAULT_PAGE_SIZE = 25;
// SOQL refuses an OFFSET above 2,000. GenericQueryService reports the last reachable page as maxPageNumber.
const MAX_OFFSET = 2000;
// A pagination cursor (deep-paging) holds at most this many rows.
const MAX_CURSOR_ROWS = 100000;
const SEARCH_DEBOUNCE_MS = 300;
const BULK_DELETE_ACTION_NAME = '__bulkDelete';
const MASS_UPDATE_ACTION_NAME = '__massUpdate';
// A bulk change fires many events; wait for them to settle before reacting.
const LIVE_CHANGE_DEBOUNCE_MS = 2000;
// Change events reach the browser a moment after the save that caused them.
const OWN_WRITE_WINDOW_MS = 3000;
// Rows per saveRecords call, so a large mass update stays well inside governor limits.
const SAVE_CHUNK_SIZE = 200;
// Rows per queryBatch call when exporting (the server's cap).
const EXPORT_BATCH_SIZE = 2000;
const DEFAULT_MAX_EXPORT_ROWS = 50000;
// Column types rendered by c-extended-datatable instead of lightning-datatable.
const EXTENDED_TYPES = new Set(['picklist', 'lookup', 'richText']);
const FUNCTION_LABELS = { SUM: 'Sum', AVG: 'Average', MIN: 'Lowest', MAX: 'Highest', COUNT: 'Count' };

/**
 * Generic, schema-driven server-side datatable: point it at an object and a
 * column list and it wires up the full pipeline every project ends up
 * building - server-side query, pagination (page-based or infinite
 * scroll), sorting, per-column filtering, a global search box, inline
 * editing with bulk save, an optional bulk-delete action, and partial-error
 * reporting - against GenericQueryService/GenericDmlService instead of a
 * bespoke Apex controller.
 *
 * Column config is the standard lightning-datatable column shape, with these
 * extensions:
 *  - `filterable: true` renders a quick-filter input for that column
 *    (server-side, via GenericQueryService), using `filterOperator`
 *    (default '=') as the SOQL operator.
 *  - a `fieldName` containing a relationship path (e.g. "Owner.Name") is
 *    queried as-is and flattened onto each row under an alias
 *    (`Owner_Name`) so lightning-datatable - which requires flat,
 *    dot-free field names - can render it; that alias is substituted
 *    automatically, no extra config needed.
 *  - `linkToRecord: true` shows the value as a link to the row's record (or, for
 *    a relationship path such as Owner.Name, to the related record). The column
 *    can still be edited inline.
 *  - `type: 'picklist'` edits with a dropdown. Its options come from the field's
 *    picklist values (the user's default record type), or from `options`.
 *  - `type: 'lookup'` edits with a record picker; give `typeAttributes.objectApiName`
 *    (the related object) and `displayField` (e.g. "Parent.Name") for the name to show.
 *  - `type: 'richText'` shows formatted text and edits it with a rich-text editor.
 *
 * Optional extras:
 *  - `row-actions` adds a menu to each row: "view", "edit" and "delete" are built in
 *    (delete asks first and can be undone); anything else fires `rowaction`. A
 *    `rowaction` event fires for the built-in ones too, and calling preventDefault()
 *    on it replaces the built-in behaviour.
 *  - `enable-mass-update` adds an "Update field" bulk action: set one editable column
 *    to one value on every selected row, saved in chunks, with conflict checks when
 *    `enable-conflict-detection` is on and per-row errors kept as drafts to retry.
 *  - `enable-export` adds an export button that downloads every row matching the
 *    current search and filters (not just the selection) as CSV, in the table's sort
 *    order, with progress and a cancel button. `max-export-rows` caps it (50,000).
 *  - `totals` shows a totals row under the table, computed server-side over every
 *    matching row: [{ fieldName: 'AnnualRevenue', functionName: 'SUM' }].
 *  - `deep-paging` pages with an Apex pagination cursor (CursorPagingService) instead
 *    of OFFSET, so page-by-page browsing reaches 100,000 rows instead of 2,000.
 *  - Deletes made from the table (bulk or row action) can be undone: an "Undo" bar
 *    restores the records from the Recycle Bin.
 *  - `enable-column-chooser` adds a button that lets each user hide and show
 *    columns (the full column list is still queried, so toggling is instant).
 *  - `view-key` turns on saved views: a toolbar to save the table's current
 *    columns, sort, search and filters under a name, reopen them later, and
 *    pick one that opens by default. Views are private to each user. The key
 *    only has to be unique per table, e.g. "accounts-main". The first query
 *    waits for the default view, so the table does not load twice.
 *  - `auto-refresh` keeps the table current: when records of the object change
 *    (Change Data Capture must be enabled for it), a page-mode table with no
 *    unsaved edits and nothing selected reloads quietly. Otherwise it shows a
 *    "records changed" bar and leaves the choice to the user, so a refresh
 *    never throws away someone's edits or selection. Changes this table just
 *    saved itself are ignored. If the subscription cannot be made a
 *    `liveerror` event is fired and the table carries on without live updates.
 *
 * Events: `load` (a page arrived), `save` (inline or mass-update save finished),
 * `delete`, `restore` (undo), `rowaction`, `bulkaction`, `export` and `liveerror`.
 */
export default class EnterpriseDatatable extends NavigationMixin(LightningElement) {
    @api objectApiName;
    @api title = '';
    @api keyField = 'Id';
    @api paginationMode = 'pages'; // 'pages' | 'infinite'
    @api searchFields = [];
    @api searchPlaceholder = 'Search...';
    @api staticFilters = [];
    @api defaultSortField;
    @api defaultSortDirection = 'asc';
    @api enableRowSelection = false;
    @api bulkActions = [];
    @api enableConflictDetection = false;
    @api enableColumnChooser = false;
    @api viewKey;
    @api autoRefresh = false;
    @api hideRefreshButton = false;
    @api enableMassUpdate = false;
    @api enableExport = false;
    @api exportFileName;
    @api maxExportRows = DEFAULT_MAX_EXPORT_ROWS;
    @api deepPaging = false;
    @api recordUrlTemplate = DEFAULT_RECORD_URL_TEMPLATE;
    @api totals = [];

    records = [];
    draftValues = [];
    datatableErrors = {};
    isLoading = false;
    isLoadingMore = false;
    hasLoadedOnce = false;
    hasError = false;
    errorMessage = '';
    currentPage = 1;
    totalCount = 0;
    hasMoreRecords = false;
    sortedBy;
    sortedDirection;
    searchTerm = '';
    columnFilters = {};
    selectedRows = [];
    canDeleteObject = false;
    canEditObject = false;
    visibleFields = null; // null = every column; otherwise the fieldNames to show
    showColumnChooser = false;
    hasPendingChanges = false;
    // lightning-datatable keeps in-progress cell edits to itself; cellchange is how we learn there are some.
    hasLocalEdits = false;
    saveProgress = '';
    undoState = null; // { recordIds, message } after a delete that can be undone
    isRestoring = false;
    isExporting = false;
    exportedCount = 0;
    exportCancelRequested = false;
    totalsValues = null;
    totalsError = '';
    totalsKey;
    totalsRequestId = 0;
    picklistObjectApiName;
    picklistRecordTypeId;
    picklistValuesByField = {};

    isActive = false;
    lastOwnWriteAt = 0;
    stopWatching;
    _columns = [];
    _pageSize = DEFAULT_PAGE_SIZE;
    _enableBulkDelete = false;
    _rowActions = [];
    accessRequested = false;
    hasRequestedData = false;
    maxPageNumber;

    @api
    get columns() {
        return this._columns;
    }
    set columns(value) {
        this._columns = Array.isArray(value) ? value : [];
        this.updatePicklistSource();
    }

    @api
    get pageSize() {
        return this._pageSize;
    }
    set pageSize(value) {
        const next = Number(value) > 0 ? Number(value) : DEFAULT_PAGE_SIZE;
        const changed = next !== this._pageSize;
        this._pageSize = next;
        // A parent may only know the size after the table has loaded (the demo reads it from custom metadata).
        if (changed && this.hasRequestedData) {
            this.loadPage(1, { append: false });
        }
    }

    @api
    get enableBulkDelete() {
        return this._enableBulkDelete;
    }
    set enableBulkDelete(value) {
        this._enableBulkDelete = value;
        // The flag may arrive after the table is on the page (the demo turns it on once a permission check returns).
        if (value && this.isActive) {
            this.checkObjectAccess();
        }
    }

    /** "view,edit,delete", or an array of names and { label, name, iconName } objects. */
    @api
    get rowActions() {
        return this._rowActions;
    }
    set rowActions(value) {
        this._rowActions = normalizeRowActions(value);
        if (this.isActive && this.needsObjectAccess) {
            this.checkObjectAccess();
        }
    }

    _debouncedReload = debounce(() => this.loadPage(1, { append: false }), SEARCH_DEBOUNCE_MS);
    _debouncedLiveChange = debounce(() => this.reactToLiveChange(), LIVE_CHANGE_DEBOUNCE_MS);

    @wire(getObjectInfo, { objectApiName: '$picklistObjectApiName' })
    handleObjectInfo({ data }) {
        if (data) {
            this.picklistRecordTypeId = data.defaultRecordTypeId;
        }
    }

    @wire(getPicklistValuesByRecordType, { objectApiName: '$picklistObjectApiName', recordTypeId: '$picklistRecordTypeId' })
    handlePicklistValues({ data }) {
        if (data && data.picklistFieldValues) {
            const byField = {};
            Object.keys(data.picklistFieldValues).forEach((fieldName) => {
                byField[fieldName] = (data.picklistFieldValues[fieldName].values || []).map(({ label, value }) => ({ label, value }));
            });
            this.picklistValuesByField = byField;
        }
    }

    connectedCallback() {
        this.isActive = true;
        this.sortedBy = this.defaultSortField;
        this.sortedDirection = this.defaultSortDirection;
        this.updatePicklistSource();
        if (this.viewKey) {
            // The view bar reports the default view first (see handleViewsReady), so the
            // table loads once, with that view's settings, instead of twice.
            this.isLoading = true;
        } else {
            this.loadPage(1, { append: false });
        }

        if (this.needsObjectAccess) {
            this.checkObjectAccess();
        }

        if (this.autoRefresh) {
            this.startWatching();
        }
    }

    get needsObjectAccess() {
        return (
            this.enableBulkDelete ||
            this.enableMassUpdate ||
            this._rowActions.some((action) => action.name === 'delete' || action.name === 'edit')
        );
    }

    checkObjectAccess() {
        if (this.accessRequested) {
            return;
        }
        this.accessRequested = true;
        getObjectAccess(this.objectApiName)
            .then((access) => {
                this.canDeleteObject = !!access.isDeletable;
                this.canEditObject = !!access.isUpdateable;
            })
            .catch(() => {
                this.canDeleteObject = false;
                this.canEditObject = false;
            });
    }

    /** Picklist columns without their own options read the field's values, once, for the object. */
    updatePicklistSource() {
        const needsValues = this._columns.some((column) => column.type === 'picklist' && !hasOwnOptions(column));
        const next = needsValues && this.objectApiName ? this.objectApiName : undefined;
        if (next !== this.picklistObjectApiName) {
            this.picklistObjectApiName = next;
        }
    }

    disconnectedCallback() {
        this.isActive = false;
        this._debouncedLiveChange.cancel();
        this.exportCancelRequested = true;
        if (this.stopWatching) {
            this.stopWatching();
            this.stopWatching = undefined;
        }
    }

    async startWatching() {
        try {
            const stop = await subscribeToObjectChanges(this.objectApiName, () => this.handleLiveChange());
            if (this.isActive) {
                this.stopWatching = stop;
            } else {
                // Removed from the page while the subscription was being made.
                stop();
            }
        } catch (error) {
            this.dispatchEvent(new CustomEvent('liveerror', { detail: { message: reduceApexErrors(error).join(' ') } }));
        }
    }

    handleLiveChange() {
        if (Date.now() - this.lastOwnWriteAt < OWN_WRITE_WINDOW_MS) {
            return;
        }
        this._debouncedLiveChange();
    }

    reactToLiveChange() {
        if (!this.isActive) {
            return;
        }
        if (this.isLoading) {
            // A load already under way may have read the data before this change; look again once it ends.
            this._debouncedLiveChange();
            return;
        }
        // Infinite mode would lose every page loaded so far, and drafts/selection would be discarded: ask first.
        const canReloadQuietly = this.isPagesMode && !this.hasUnsavedEdits && this.selectedRows.length === 0;
        if (!canReloadQuietly) {
            this.hasPendingChanges = true;
            return;
        }
        this.loadPage(this.currentPage, { append: false }).then(() => {
            // The page we were on may no longer exist (rows deleted elsewhere): fall back to the last one.
            if (this.records.length === 0 && this.totalCount > 0 && this.currentPage > 1) {
                this.loadPage(this.totalPages, { append: false });
            }
        });
    }

    get isPagesMode() {
        return this.paginationMode !== 'infinite';
    }

    get isInfiniteMode() {
        return this.paginationMode === 'infinite';
    }

    /** The last page the server lets us request at this page size (OFFSET's limit, or a cursor's). */
    get maxReachablePage() {
        if (this.maxPageNumber) {
            return this.maxPageNumber;
        }
        return this.deepPaging ? Math.ceil(MAX_CURSOR_ROWS / this.pageSize) : Math.floor(MAX_OFFSET / this.pageSize) + 1;
    }

    get matchingPages() {
        return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
    }

    get totalPages() {
        return Math.min(this.matchingPages, this.maxReachablePage);
    }

    get isPagingCapped() {
        return this.matchingPages > this.maxReachablePage;
    }

    get showPagingCapMessage() {
        // Page mode says so up front; infinite mode once scrolling has stopped short.
        return this.isPagingCapped && (this.isPagesMode || !this.hasMoreRecords);
    }

    get pagingCapMessage() {
        const reachable = Math.min(this.totalCount, this.maxReachablePage * this.pageSize);
        return `Only the first ${reachable.toLocaleString(LOCALE)} of ${this.totalCount.toLocaleString(LOCALE)} records can be paged through. Narrow the search or filters to reach the rest.`;
    }

    get isFirstPage() {
        return this.currentPage <= 1;
    }

    get isLastPage() {
        return this.currentPage >= this.totalPages;
    }

    get pageStatusLabel() {
        return `Page ${this.currentPage} of ${this.totalPages} • ${this.totalCount} record${this.totalCount === 1 ? '' : 's'}`;
    }

    get isInitialLoading() {
        return this.isLoading && !this.hasLoadedOnce;
    }

    get isReloading() {
        return this.isLoading && this.hasLoadedOnce;
    }

    get isEmpty() {
        return this.hasLoadedOnce && !this.isLoading && !this.hasError && this.records.length === 0;
    }

    get hideCheckboxColumn() {
        return !this.enableRowSelection;
    }

    /** lightning-datatable's selected-rows takes key-field values, not row objects. */
    get selectedRowKeys() {
        return this.selectedRows.map((row) => row[this.keyField]);
    }

    get isLoadMoreDisabled() {
        return !this.hasMoreRecords;
    }

    get hasSearch() {
        return Array.isArray(this.searchFields) && this.searchFields.length > 0;
    }

    get filterableColumns() {
        return this.columns.filter((column) => column.filterable);
    }

    get hasFilterableColumns() {
        return this.filterableColumns.length > 0;
    }

    get filterInputs() {
        return this.filterableColumns.map((column) => ({
            fieldName: column.fieldName,
            label: column.label,
            value: this.columnFilters[column.fieldName] || ''
        }));
    }

    /**
     * Reloading would swap in the latest SystemModstamp values, so an edit made against the old
     * version would then pass conflict detection and overwrite someone else's change.
     */
    get hasUnsavedEdits() {
        return this.hasLocalEdits || this.draftValues.length > 0;
    }

    get changesNotice() {
        return this.hasUnsavedEdits
            ? 'Records have changed. Refreshing will discard your unsaved edits.'
            : 'Records have changed since this list was loaded.';
    }

    get hasViewBar() {
        return !!this.viewKey;
    }

    get visibleColumns() {
        const columns = this.columns;
        if (!this.visibleFields) {
            return columns;
        }
        const shown = new Set(this.visibleFields);
        // Columns without a fieldName (row actions, buttons) cannot be hidden.
        return columns.filter((column) => !column.fieldName || shown.has(column.fieldName));
    }

    get columnChooserItems() {
        return this.columns.filter((column) => column.fieldName).map(({ fieldName, label }) => ({ fieldName, label }));
    }

    get columnChooserVariant() {
        return this.showColumnChooser || this.visibleFields ? 'brand' : 'border';
    }

    /** The sort column as lightning-datatable knows it (relationship paths are flattened to an alias). */
    get tableSortedBy() {
        return this.sortedBy && this.sortedBy.includes('.') ? toAlias(this.sortedBy) : this.sortedBy;
    }

    /**
     * The table's current layout as a plain object: visible columns, sort, search
     * and filters. This is what a saved view stores, and what applyConfig accepts.
     */
    @api
    get currentConfig() {
        const filters = {};
        Object.keys(this.columnFilters)
            .sort()
            .forEach((fieldName) => {
                if (this.columnFilters[fieldName] !== '' && this.columnFilters[fieldName] != null) {
                    filters[fieldName] = this.columnFilters[fieldName];
                }
            });
        return {
            v: 1,
            columns: this.visibleFields ? [...this.visibleFields] : null,
            sortedBy: this.sortedBy,
            sortedDirection: this.sortedDirection,
            searchTerm: this.searchTerm,
            columnFilters: filters
        };
    }

    get queryFields() {
        const fields = new Set([this.keyField]);
        this.columns.forEach((column) => {
            if (column.fieldName) {
                fields.add(column.fieldName);
                if (column.linkToRecord && column.fieldName.includes('.')) {
                    fields.add(relatedIdPath(column.fieldName));
                }
            }
            if (column.type === 'lookup' && column.displayField) {
                fields.add(column.displayField);
            }
        });
        if (this.enableConflictDetection) {
            fields.add('SystemModstamp');
        }
        return Array.from(fields);
    }

    /** True when a column needs one of c-extended-datatable's types; plain tables keep lightning-datatable. */
    get usesExtendedTypes() {
        return this.columns.some((column) => column.linkToRecord || EXTENDED_TYPES.has(column.type));
    }

    get tableColumns() {
        const columns = this.visibleColumns.map((column) => this.toTableColumn(column));
        const actions = this.availableRowActions;
        if (actions.length) {
            columns.push({ type: 'action', typeAttributes: { rowActions: actions, menuAlignment: 'auto' } });
        }
        return columns;
    }

    toTableColumn(column) {
        if (!column.fieldName) {
            return column;
        }
        const fieldName = toAlias(column.fieldName);
        const base = fieldName === column.fieldName ? column : { ...column, fieldName };
        const typeAttributes = column.typeAttributes || {};
        if (column.linkToRecord) {
            return {
                ...base,
                type: 'recordLink',
                typeAttributes: { label: column.label, target: '_self', ...typeAttributes, url: { fieldName: linkAlias(column) } }
            };
        }
        if (column.type === 'picklist') {
            return {
                ...base,
                typeAttributes: { label: column.label, placeholder: 'Select an option', ...typeAttributes, options: this.picklistOptionsFor(column) }
            };
        }
        if (column.type === 'lookup') {
            return {
                ...base,
                typeAttributes: {
                    label: column.label,
                    nameField: 'Name',
                    urlTemplate: this.recordUrlTemplate,
                    ...typeAttributes,
                    originalValue: { fieldName },
                    displayValue: column.displayField ? { fieldName: toAlias(column.displayField) } : undefined
                }
            };
        }
        if (column.type === 'richText') {
            return { ...base, wrapText: true, typeAttributes: { label: column.label, ...typeAttributes } };
        }
        return base;
    }

    picklistOptionsFor(column) {
        const given = (column.typeAttributes && column.typeAttributes.options) || column.options;
        const options = Array.isArray(given) ? given : this.picklistValuesByField[column.fieldName] || [];
        return column.required ? options : [{ label: '--None--', value: '' }, ...options.filter((option) => option.value !== '')];
    }

    get availableRowActions() {
        return this._rowActions.filter(
            (action) => (action.name !== 'delete' || this.canDeleteObject) && (action.name !== 'edit' || this.canEditObject)
        );
    }

    /** Editable columns of the object itself: what the "Update field" dialog offers. */
    get massUpdateFields() {
        return this.columns
            .filter((column) => column.editable && column.fieldName && !column.fieldName.includes('.'))
            .map((column) => ({
                fieldName: column.fieldName,
                label: column.label || column.fieldName,
                type: column.type || 'text',
                options: column.type === 'picklist' ? this.picklistOptionsFor(column) : undefined,
                objectApiName: column.typeAttributes ? column.typeAttributes.objectApiName : undefined
            }));
    }

    get resolvedBulkActions() {
        const actions = [...(this.bulkActions || [])];
        if (this.enableMassUpdate && this.canEditObject && this.massUpdateFields.length) {
            actions.push({ name: MASS_UPDATE_ACTION_NAME, label: 'Update field', iconName: 'utility:edit' });
        }
        if (this.enableBulkDelete && this.canDeleteObject) {
            actions.push({
                name: BULK_DELETE_ACTION_NAME,
                label: 'Delete',
                variant: 'destructive',
                iconName: 'utility:delete'
            });
        }
        return actions;
    }

    get hasSaveProgress() {
        return !!this.saveProgress;
    }

    get hasUndo() {
        return !!this.undoState;
    }

    get exportProgressLabel() {
        const total = Math.min(this.totalCount, this.exportLimit);
        return `Exporting ${this.exportedCount.toLocaleString(LOCALE)} of ${total.toLocaleString(LOCALE)} records...`;
    }

    get exportLimit() {
        const limit = Math.floor(Number(this.maxExportRows));
        return limit > 0 ? limit : DEFAULT_MAX_EXPORT_ROWS;
    }

    get hasTotals() {
        return Array.isArray(this.totals) && this.totals.length > 0;
    }

    get hasTotalsError() {
        return !!this.totalsError;
    }

    get totalsCaption() {
        return `Totals for all ${this.totalCount.toLocaleString(LOCALE)} matching record${this.totalCount === 1 ? '' : 's'}`;
    }

    get totalsItems() {
        return (this.totals || []).map((total, index) => {
            const functionName = String(total.functionName || 'SUM').toUpperCase();
            const column = this.columns.find((candidate) => candidate.fieldName === total.fieldName) || {};
            const label = total.label || `${FUNCTION_LABELS[functionName] || functionName} of ${column.label || total.fieldName}`;
            const format = column.type === 'currency' || column.type === 'percent' ? column.type : 'number';
            const value = this.totalsValues ? this.totalsValues[`t${index}`] : undefined;
            const currencyCode = total.currencyCode || (column.typeAttributes && column.typeAttributes.currencyCode);
            return {
                key: `t${index}`,
                label,
                value: this.totalsValues ? formatNumber(value, functionName === 'COUNT' ? 'number' : format, currencyCode) : '…'
            };
        });
    }

    /** Re-runs the current query. Infinite mode resets back to page 1. */
    @api
    refresh() {
        this.selectedRows = [];
        this.draftValues = [];
        this.hasLocalEdits = false;
        this.datatableErrors = {};
        return this.loadPage(this.isInfiniteMode ? 1 : this.currentPage, { append: false });
    }

    /**
     * Applies a layout produced by `currentConfig` (or loaded from a saved view) and
     * re-queries from page 1. Anything the config mentions that this table no longer has -
     * a removed column, a field that is not filterable - is ignored, and a null/empty
     * config resets the table to its defaults.
     */
    @api
    applyConfig(config) {
        this.restoreConfig(config);
        return this.loadPage(1, { append: false });
    }

    restoreConfig(config) {
        const settings = config && typeof config === 'object' ? config : {};
        const known = this.columns.filter((column) => column.fieldName).map((column) => column.fieldName);

        const requested = Array.isArray(settings.columns) ? known.filter((name) => settings.columns.includes(name)) : [];
        this.visibleFields = requested.length && requested.length < known.length ? requested : null;

        const sortIsKnown = known.includes(settings.sortedBy);
        this.sortedBy = sortIsKnown ? settings.sortedBy : this.defaultSortField;
        this.sortedDirection =
            sortIsKnown && ['asc', 'desc'].includes(settings.sortedDirection) ? settings.sortedDirection : this.defaultSortDirection;

        this.searchTerm = typeof settings.searchTerm === 'string' ? settings.searchTerm : '';

        const savedFilters = settings.columnFilters && typeof settings.columnFilters === 'object' ? settings.columnFilters : {};
        const filters = {};
        this.filterableColumns.forEach((column) => {
            if (typeof savedFilters[column.fieldName] === 'string' && savedFilters[column.fieldName] !== '') {
                filters[column.fieldName] = savedFilters[column.fieldName];
            }
        });
        this.columnFilters = filters;
    }

    buildFilters() {
        const filters = [...(this.staticFilters || [])];
        Object.keys(this.columnFilters).forEach((fieldName) => {
            const value = this.columnFilters[fieldName];
            if (value === '' || value === null || value === undefined) {
                return;
            }
            const columnDef = this.columns.find((column) => column.fieldName === fieldName);
            filters.push({ fieldName, operatorName: columnDef?.filterOperator || '=', value });
        });
        return filters;
    }

    loadPage(pageNumber, { append }) {
        this.hasRequestedData = true;
        this.isLoading = true;
        this.isLoadingMore = !!append;
        this.hasError = false;
        this.hasPendingChanges = false;

        const fetchPage = this.deepPaging ? queryPage : queryRecords;
        return fetchPage({
            objectApiName: this.objectApiName,
            fields: this.queryFields,
            filters: this.buildFilters(),
            sortField: this.sortedBy,
            sortDirection: this.sortedDirection,
            searchTerm: this.searchTerm,
            searchFields: this.searchFields,
            pageNumber,
            pageSize: this.pageSize
        })
            .then((result) => {
                const flattened = (result.records || []).map((record) => this.flattenRow(record));
                this.records = append ? [...this.records, ...flattened] : flattened;
                this.totalCount = result.totalCount;
                this.currentPage = result.pageNumber;
                this.maxPageNumber = result.maxPageNumber;
                this.hasMoreRecords = result.hasMore && result.pageNumber < this.maxReachablePage;
                this.hasLoadedOnce = true;
                if (!append) {
                    this.loadTotals(false);
                }
                this.dispatchEvent(
                    new CustomEvent('load', {
                        detail: { records: flattened, totalCount: this.totalCount, pageNumber: this.currentPage, pageSize: this.pageSize }
                    })
                );
            })
            .catch((error) => {
                this.hasError = true;
                this.errorMessage = reduceApexErrors(error).join(' ');
            })
            .finally(() => {
                this.isLoading = false;
                this.isLoadingMore = false;
            });
    }

    flattenRow(record) {
        const flattened = { ...record };
        this.columns.forEach((column) => {
            if (!column.fieldName) {
                return;
            }
            if (column.fieldName.includes('.')) {
                flattened[toAlias(column.fieldName)] = getNestedValue(record, column.fieldName);
            }
            if (column.type === 'lookup' && column.displayField) {
                flattened[toAlias(column.displayField)] = getNestedValue(record, column.displayField);
            }
            if (column.linkToRecord) {
                const linkedId = column.fieldName.includes('.') ? getNestedValue(record, relatedIdPath(column.fieldName)) : record.Id;
                flattened[linkAlias(column)] = recordUrl(this.recordUrlTemplate, linkedId);
            }
        });
        return flattened;
    }

    /**
     * Totals cover every row the search and filters match, so they only need recalculating
     * when those change (not on every page), or after a save or delete (force).
     */
    loadTotals(force) {
        if (!this.hasTotals) {
            return Promise.resolve();
        }
        const filters = this.buildFilters();
        const key = JSON.stringify({ filters, searchTerm: this.searchTerm, totals: this.totals });
        if (!force && key === this.totalsKey) {
            return Promise.resolve();
        }
        this.totalsKey = key;
        this.totalsRequestId += 1;
        const requestId = this.totalsRequestId;
        return summarize({
            request: {
                objectApiName: this.objectApiName,
                aggregates: this.totals.map((total, index) => ({
                    functionName: String(total.functionName || 'SUM').toUpperCase(),
                    fieldName: total.fieldName || null,
                    alias: `t${index}`
                })),
                groupByFields: [],
                filters,
                searchTerm: this.searchTerm,
                searchFields: this.searchFields
            }
        })
            .then((rows) => {
                if (requestId === this.totalsRequestId) {
                    this.totalsValues = (rows && rows[0] && rows[0].values) || {};
                    this.totalsError = '';
                }
            })
            .catch((error) => {
                if (requestId === this.totalsRequestId) {
                    this.totalsValues = null;
                    this.totalsError = `Totals could not be calculated: ${reduceApexErrors(error).join(' ')}`;
                    // Let the next load try again.
                    this.totalsKey = undefined;
                }
            });
    }

    handleSort(event) {
        // lightning-datatable reports the flattened alias (Owner_Name); the server needs the real path.
        const reported = event.detail.fieldName;
        const column = this.columns.find(
            (candidate) => candidate.fieldName && (candidate.fieldName === reported || toAlias(candidate.fieldName) === reported)
        );
        this.sortedBy = column ? column.fieldName : reported;
        this.sortedDirection = event.detail.sortDirection;
        this.loadPage(1, { append: false });
    }

    handleColumnChooserToggle() {
        this.showColumnChooser = !this.showColumnChooser;
    }

    handleVisibleFieldsChange(event) {
        const chosen = event.detail.visibleFields;
        this.visibleFields = chosen.length >= this.columnChooserItems.length ? null : chosen;
    }

    handleViewsReady(event) {
        if (event.detail.config) {
            this.restoreConfig(event.detail.config);
        }
        this.loadPage(1, { append: false });
    }

    handleViewSelect(event) {
        this.applyConfig(event.detail.config);
    }

    handleSearchInput(event) {
        this.searchTerm = event.target.value;
        this._debouncedReload();
    }

    handleColumnFilterInput(event) {
        const { fieldName } = event.currentTarget.dataset;
        this.columnFilters = { ...this.columnFilters, [fieldName]: event.target.value };
        this._debouncedReload();
    }

    handlePreviousClick() {
        if (!this.isFirstPage) {
            this.loadPage(this.currentPage - 1, { append: false });
        }
    }

    handleNextClick() {
        if (!this.isLastPage) {
            this.loadPage(this.currentPage + 1, { append: false });
        }
    }

    handleLoadMore() {
        if (this.hasMoreRecords && !this.isLoading) {
            this.loadPage(this.currentPage + 1, { append: true });
        }
    }

    handleRefreshClick() {
        this.refresh();
    }

    handleRowSelection(event) {
        this.selectedRows = event.detail.selectedRows;
    }

    handleBulkActionClear() {
        this.clearSelection();
    }

    clearSelection() {
        this.selectedRows = [];
        const datatable = this.template.querySelector('.records-table');
        if (datatable) {
            datatable.selectedRows = [];
        }
    }

    async handleBulkAction(event) {
        const { name } = event.detail;
        if (name === BULK_DELETE_ACTION_NAME) {
            await this.handleBulkDelete();
            return;
        }
        if (name === MASS_UPDATE_ACTION_NAME) {
            await this.handleMassUpdate();
            return;
        }
        this.dispatchEvent(new CustomEvent('bulkaction', { detail: { name, selectedRows: this.selectedRows } }));
    }

    async handleRowAction(event) {
        const { action, row } = event.detail;
        // The parent hears about every action first, and can replace a built-in one with preventDefault().
        const rowActionEvent = new CustomEvent('rowaction', { detail: { name: action.name, action, row }, cancelable: true });
        this.dispatchEvent(rowActionEvent);
        if (rowActionEvent.defaultPrevented) {
            return;
        }
        if (action.name === 'view' || action.name === 'edit') {
            navigateToRecord(this, row.Id || row[this.keyField], this.objectApiName, action.name);
        } else if (action.name === 'delete') {
            await this.deleteRows([row]);
        }
    }

    handleBulkDelete() {
        return this.deleteRows(this.selectedRows);
    }

    async deleteRows(rows) {
        const count = rows.length;
        if (!count) {
            return;
        }
        const confirmed = await ConfirmDialog.open({
            label: count === 1 ? 'Delete Record' : 'Delete Records',
            message: `This will delete ${count} record${count === 1 ? '' : 's'}. You can undo this straight afterwards, or restore ${count === 1 ? 'it' : 'them'} from the Recycle Bin later.`,
            variant: 'destructive',
            confirmLabel: 'Delete'
        });
        if (!confirmed) {
            return;
        }

        const ids = rows.map((row) => row[this.keyField]);
        this.isLoading = true;
        try {
            const results = await deleteRecords({ objectApiName: this.objectApiName, recordIds: ids });
            const succeededIds = results.filter((result) => result.success).map((result) => result.rowKey);
            const failed = results.filter((result) => !result.success);
            const deleted = new Set(succeededIds);

            this.records = this.records.filter((record) => !deleted.has(record[this.keyField]));
            this.totalCount = Math.max(0, this.totalCount - succeededIds.length);
            const stillSelected = this.selectedRows.filter((row) => !deleted.has(row[this.keyField]));
            if (stillSelected.length) {
                this.selectedRows = stillSelected;
            } else {
                this.clearSelection();
            }

            if (failed.length) {
                showErrorToast(
                    this,
                    `${succeededIds.length} deleted, ${failed.length} failed: ${failed.map((f) => f.message).join(' ')}`
                );
            }
            if (succeededIds.length) {
                this.undoState = {
                    recordIds: succeededIds,
                    message: `${succeededIds.length} record${succeededIds.length === 1 ? '' : 's'} deleted.`
                };
                notifyRecordsChanged(succeededIds);
                this.dispatchEvent(new CustomEvent('delete', { detail: { recordIds: succeededIds } }));
                this.loadTotals(true);
            }
        } catch (error) {
            showErrorToast(this, reduceApexErrors(error));
        } finally {
            this.isLoading = false;
            this.lastOwnWriteAt = Date.now();
        }
    }

    /** Restores the records of the last delete from the Recycle Bin. */
    async handleUndoDelete() {
        if (!this.undoState || this.isRestoring) {
            return;
        }
        const { recordIds } = this.undoState;
        this.isRestoring = true;
        try {
            const results = await undeleteRecords({ objectApiName: this.objectApiName, recordIds });
            const restored = results.filter((result) => result.success).map((result) => result.rowKey);
            const failed = results.filter((result) => !result.success);
            this.undoState = null;
            if (failed.length) {
                showErrorToast(
                    this,
                    `${restored.length} restored, ${failed.length} could not be: ${failed.map((f) => f.message).join(' ')}`
                );
            } else {
                showSuccessToast(this, `${restored.length} record${restored.length === 1 ? '' : 's'} restored.`);
            }
            if (restored.length) {
                notifyRecordsChanged(restored);
                this.dispatchEvent(new CustomEvent('restore', { detail: { recordIds: restored } }));
                this.lastOwnWriteAt = Date.now();
                await this.loadPage(this.isInfiniteMode ? 1 : this.currentPage, { append: false });
                this.loadTotals(true);
            }
        } catch (error) {
            showErrorToast(this, reduceApexErrors(error));
        } finally {
            this.isRestoring = false;
            this.lastOwnWriteAt = Date.now();
        }
    }

    handleUndoDismiss() {
        this.undoState = null;
    }

    async handleMassUpdate() {
        const rows = [...this.selectedRows];
        if (!rows.length) {
            return;
        }
        if (this.hasUnsavedEdits) {
            showErrorToast(this, 'Save or cancel your edits in the table first.');
            return;
        }
        const choice = await MassUpdateDialog.open({ size: 'small', recordCount: rows.length, fields: this.massUpdateFields });
        if (!choice || !choice.fieldName) {
            return;
        }
        // The Id makes each draft an update even when the table is keyed on another field.
        const drafts = rows.map((row) => ({ Id: row.Id, [this.keyField]: row[this.keyField], [choice.fieldName]: choice.value }));
        await this.saveDrafts(drafts, 'massUpdate');
    }

    buildSaveInput(draft) {
        const input = { rowKey: draft[this.keyField], fields: { ...draft } };
        if (this.enableConflictDetection) {
            const loaded = this.records.find((record) => record[this.keyField] === draft[this.keyField]);
            if (loaded && loaded.SystemModstamp !== undefined && loaded.SystemModstamp !== null) {
                input.expectedModstamp = new Date(loaded.SystemModstamp).getTime();
            }
        }
        return input;
    }

    handleCellChange() {
        this.hasLocalEdits = true;
    }

    handleSave(event) {
        return this.saveDrafts(event.detail.draftValues, 'inline');
    }

    /**
     * Saves drafts (inline edits, or one value on many rows) in chunks of 200. Saved rows are
     * merged into the table; failed rows stay as drafts with their errors, so they can be
     * fixed and saved again.
     */
    async saveDrafts(draftValues, source) {
        this.isLoading = true;
        const inputs = draftValues.map((draft) => this.buildSaveInput(draft));
        const chunks = toChunks(inputs, SAVE_CHUNK_SIZE);

        try {
            const results = [];
            for (let index = 0; index < chunks.length; index++) {
                if (chunks.length > 1) {
                    this.saveProgress = `Saving ${(index * SAVE_CHUNK_SIZE).toLocaleString(LOCALE)} of ${inputs.length.toLocaleString(LOCALE)} records...`;
                }
                try {
                    // One chunk at a time on purpose: each is its own transaction, and parallel
                    // chunks would multiply the load and race each other's conflict checks.
                    // eslint-disable-next-line no-await-in-loop
                    results.push(...(await saveRecords({ objectApiName: this.objectApiName, records: chunks[index] })));
                } catch (chunkError) {
                    if (chunks.length === 1) {
                        throw chunkError;
                    }
                    const message = reduceApexErrors(chunkError).join(' ');
                    chunks[index].forEach((input) => results.push({ rowKey: input.rowKey, success: false, message }));
                }
            }
            this.applySaveResults(draftValues, results, source);
        } catch (error) {
            showErrorToast(this, reduceApexErrors(error));
        } finally {
            this.saveProgress = '';
            this.isLoading = false;
            this.lastOwnWriteAt = Date.now();
        }
    }

    applySaveResults(draftValues, results, source) {
        // Whatever failed is kept in draftValues below; nothing else is still being edited.
        this.hasLocalEdits = false;
        const succeeded = results.filter((result) => result.success);
        const failed = results.filter((result) => !result.success);
        const modstampByRowKey = new Map(succeeded.filter((r) => r.modstamp != null).map((r) => [r.rowKey, r.modstamp]));
        const lookupColumns = this.columns.filter((column) => column.type === 'lookup' && column.displayField);

        if (succeeded.length) {
            const succeededRowKeys = new Set(succeeded.map((result) => result.rowKey));
            this.records = this.records.map((record) => {
                const rowKey = record[this.keyField];
                if (!succeededRowKeys.has(rowKey)) {
                    return record;
                }
                const draft = draftValues.find((d) => d[this.keyField] === rowKey);
                const updated = { ...record, ...draft };
                lookupColumns.forEach((column) => {
                    if (Object.prototype.hasOwnProperty.call(draft, column.fieldName)) {
                        // The loaded name belongs to the old record; the cell reads the new one itself.
                        updated[toAlias(column.displayField)] = undefined;
                    }
                });
                if (modstampByRowKey.has(rowKey)) {
                    // Next edit of this row must be checked against the version we just wrote.
                    updated.SystemModstamp = modstampByRowKey.get(rowKey);
                }
                return updated;
            });
        }

        if (failed.length) {
            this.datatableErrors = buildDatatableErrors(failed);
            const failedRowKeys = new Set(failed.map((result) => result.rowKey));
            this.draftValues = draftValues.filter((draft) => failedRowKeys.has(draft[this.keyField]));
            const conflictCount = failed.filter((result) => result.isConflict).length;
            const conflictNote = conflictCount ? ` ${conflictCount} changed by someone else - refresh to see the latest.` : '';
            showErrorToast(this, `${succeeded.length} saved, ${failed.length} failed.${conflictNote}`);
        } else {
            this.datatableErrors = {};
            this.draftValues = [];
            const verb = source === 'massUpdate' ? 'updated' : 'saved';
            showSuccessToast(this, `${succeeded.length} record${succeeded.length === 1 ? '' : 's'} ${verb}.`);
        }

        if (succeeded.length) {
            notifyRecordsChanged(succeeded.map((result) => result.rowKey));
            this.loadTotals(true);
        }
        this.dispatchEvent(
            new CustomEvent('save', {
                detail: {
                    source,
                    savedIds: succeeded.map((result) => result.rowKey),
                    failedRows: failed.map(({ rowKey, message, isConflict }) => ({ rowKey, message, isConflict: !!isConflict }))
                }
            })
        );
    }

    handleCancelEdit() {
        this.hasLocalEdits = false;
        this.draftValues = [];
        this.datatableErrors = {};
    }

    handleExportClick() {
        this.exportAll();
    }

    handleCancelExport() {
        this.exportCancelRequested = true;
    }

    /**
     * Downloads every row matching the current search and filters as CSV - the visible
     * columns, in the table's sort order - reading 2,000 rows a call. Stops at
     * max-export-rows. Resolves with { rowCount, truncated } or { cancelled: true }.
     */
    @api
    async exportAll() {
        if (this.isExporting) {
            return { cancelled: true };
        }
        const limit = this.exportLimit;
        this.isExporting = true;
        this.exportCancelRequested = false;
        this.exportedCount = 0;
        try {
            const rows = [];
            let afterId = null;
            let hasMore = true;
            while (hasMore && rows.length < limit && !this.exportCancelRequested) {
                // Each batch starts where the last one ended, so they cannot run in parallel.
                // eslint-disable-next-line no-await-in-loop
                const batch = await queryBatch({
                    objectApiName: this.objectApiName,
                    fields: this.queryFields,
                    filters: this.buildFilters(),
                    searchTerm: this.searchTerm,
                    searchFields: this.searchFields,
                    afterId,
                    batchSize: Math.min(EXPORT_BATCH_SIZE, limit - rows.length)
                });
                rows.push(...(batch.records || []).map((record) => this.flattenRow(record)));
                hasMore = !!batch.hasMore;
                afterId = batch.nextCursor;
                this.exportedCount = rows.length;
            }
            if (this.exportCancelRequested) {
                showSuccessToast(this, 'Export cancelled.');
                return { cancelled: true };
            }
            const truncated = hasMore;
            const exported = rows.slice(0, limit);
            this.downloadRows(sortRows(exported, this.sortedBy, this.sortedDirection));
            showSuccessToast(
                this,
                truncated
                    ? `Exported the first ${exported.length.toLocaleString(LOCALE)} records. Narrow the search or filters to export the rest.`
                    : `${exported.length.toLocaleString(LOCALE)} record${exported.length === 1 ? '' : 's'} exported.`
            );
            this.dispatchEvent(new CustomEvent('export', { detail: { rowCount: exported.length, truncated } }));
            return { rowCount: exported.length, truncated };
        } catch (error) {
            showErrorToast(this, reduceApexErrors(error));
            return { error: reduceApexErrors(error).join(' ') };
        } finally {
            this.isExporting = false;
        }
    }

    downloadRows(rows) {
        const columns = this.visibleColumns.filter((column) => column.fieldName);
        const richTextFields = columns.filter((column) => column.type === 'richText').map((column) => toAlias(column.fieldName));
        const plainRows = richTextFields.length
            ? rows.map((row) => {
                  const copy = { ...row };
                  richTextFields.forEach((fieldName) => {
                      copy[fieldName] = richTextToPlainText(copy[fieldName]);
                  });
                  return copy;
              })
            : rows;
        const fileName = this.exportFileName || `${this.objectApiName || 'records'}-export.csv`;
        downloadCsv(fileName, rowsToCsv(plainRows, columns));
    }
}

function toAlias(dottedFieldName) {
    return dottedFieldName.replace(/\./g, '_');
}

function linkAlias(column) {
    return `${toAlias(column.fieldName)}__url`;
}

function hasOwnOptions(column) {
    return Array.isArray(column.options) || !!(column.typeAttributes && Array.isArray(column.typeAttributes.options));
}

function buildDatatableErrors(failedResults) {
    const rows = {};
    failedResults.forEach((result) => {
        rows[result.rowKey] = {
            title: 'Error saving row',
            messages: [result.message || 'Unknown error'],
            fieldNames: result.fieldNames && result.fieldNames.length ? result.fieldNames : []
        };
    });
    return {
        rows,
        table: {
            title: `${failedResults.length} row(s) failed to save`,
            messages: failedResults.map((result) => result.message).filter(Boolean)
        }
    };
}
