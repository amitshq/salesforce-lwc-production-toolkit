import { LightningElement, api } from 'lwc';
import queryRecords from '@salesforce/apex/GenericQueryService.query';
import saveRecords from '@salesforce/apex/GenericDmlService.saveRecords';
import deleteRecords from '@salesforce/apex/GenericDmlService.deleteRecords';
import { reduceApexErrors } from 'c/apexErrorUtils';
import { showSuccessToast, showErrorToast } from 'c/toastService';
import { debounce } from 'c/functionUtils';
import { getNestedValue } from 'c/objectUtils';
import { getObjectAccess } from 'c/permissionUtils';
import { notifyRecordsChanged } from 'c/recordUtils';
import { subscribeToObjectChanges } from 'c/empUtils';
import ConfirmDialog from 'c/confirmDialog';

const DEFAULT_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;
const BULK_DELETE_ACTION_NAME = '__bulkDelete';
// A bulk change fires many events; wait for them to settle before reacting.
const LIVE_CHANGE_DEBOUNCE_MS = 2000;
// Change events reach the browser a moment after the save that caused them.
const OWN_WRITE_WINDOW_MS = 3000;

/**
 * Generic, schema-driven server-side datatable: point it at an object and a
 * column list and it wires up the full pipeline every project ends up
 * building - server-side query, pagination (page-based or infinite
 * scroll), sorting, per-column filtering, a global search box, inline
 * editing with bulk save, an optional bulk-delete action, and partial-error
 * reporting - against GenericQueryService/GenericDmlService instead of a
 * bespoke Apex controller.
 *
 * Column config is the standard lightning-datatable column shape, with two
 * extensions:
 *  - `filterable: true` renders a quick-filter input for that column
 *    (server-side, via GenericQueryService), using `filterOperator`
 *    (default '=') as the SOQL operator.
 *  - a `fieldName` containing a relationship path (e.g. "Owner.Name") is
 *    queried as-is and flattened onto each row under an alias
 *    (`Owner_Name`) so lightning-datatable - which requires flat,
 *    dot-free field names - can render it; that alias is substituted
 *    automatically, no extra config needed.
 *
 * Optional extras:
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
 */
export default class EnterpriseDatatable extends LightningElement {
    @api objectApiName;
    @api title = '';
    @api keyField = 'Id';
    @api columns = [];
    @api pageSize = DEFAULT_PAGE_SIZE;
    @api paginationMode = 'pages'; // 'pages' | 'infinite'
    @api searchFields = [];
    @api searchPlaceholder = 'Search...';
    @api staticFilters = [];
    @api defaultSortField;
    @api defaultSortDirection = 'asc';
    @api enableRowSelection = false;
    @api bulkActions = [];
    @api enableBulkDelete = false;
    @api enableConflictDetection = false;
    @api enableColumnChooser = false;
    @api viewKey;
    @api autoRefresh = false;
    @api hideRefreshButton = false;

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
    visibleFields = null; // null = every column; otherwise the fieldNames to show
    showColumnChooser = false;
    hasPendingChanges = false;
    // lightning-datatable keeps in-progress cell edits to itself; cellchange is how we learn there are some.
    hasLocalEdits = false;

    isActive = false;
    lastOwnWriteAt = 0;
    stopWatching;

    _debouncedReload = debounce(() => this.loadPage(1, { append: false }), SEARCH_DEBOUNCE_MS);
    _debouncedLiveChange = debounce(() => this.reactToLiveChange(), LIVE_CHANGE_DEBOUNCE_MS);

    connectedCallback() {
        this.isActive = true;
        this.sortedBy = this.defaultSortField;
        this.sortedDirection = this.defaultSortDirection;
        if (this.viewKey) {
            // The view bar reports the default view first (see handleViewsReady), so the
            // table loads once, with that view's settings, instead of twice.
            this.isLoading = true;
        } else {
            this.loadPage(1, { append: false });
        }

        if (this.enableBulkDelete) {
            getObjectAccess(this.objectApiName)
                .then((access) => {
                    this.canDeleteObject = !!access.isDeletable;
                })
                .catch(() => {
                    this.canDeleteObject = false;
                });
        }

        if (this.autoRefresh) {
            this.startWatching();
        }
    }

    disconnectedCallback() {
        this.isActive = false;
        this._debouncedLiveChange.cancel();
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

    get totalPages() {
        return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
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

    get isLoadMoreDisabled() {
        return !this.hasMoreRecords;
    }

    get hasSearch() {
        return Array.isArray(this.searchFields) && this.searchFields.length > 0;
    }

    get filterableColumns() {
        return (this.columns || []).filter((column) => column.filterable);
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
        const columns = this.columns || [];
        if (!this.visibleFields) {
            return columns;
        }
        const shown = new Set(this.visibleFields);
        // Columns without a fieldName (row actions, buttons) cannot be hidden.
        return columns.filter((column) => !column.fieldName || shown.has(column.fieldName));
    }

    get columnChooserItems() {
        return (this.columns || []).filter((column) => column.fieldName).map(({ fieldName, label }) => ({ fieldName, label }));
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
        (this.columns || []).forEach((column) => {
            if (column.fieldName) {
                fields.add(column.fieldName);
            }
        });
        if (this.enableConflictDetection) {
            fields.add('SystemModstamp');
        }
        return Array.from(fields);
    }

    get tableColumns() {
        return this.visibleColumns.map((column) => {
            if (column.fieldName && column.fieldName.includes('.')) {
                return { ...column, fieldName: toAlias(column.fieldName) };
            }
            return column;
        });
    }

    get resolvedBulkActions() {
        const actions = [...(this.bulkActions || [])];
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
        const known = (this.columns || []).filter((column) => column.fieldName).map((column) => column.fieldName);

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
            const columnDef = (this.columns || []).find((column) => column.fieldName === fieldName);
            filters.push({ fieldName, operatorName: columnDef?.filterOperator || '=', value });
        });
        return filters;
    }

    loadPage(pageNumber, { append }) {
        this.isLoading = true;
        this.isLoadingMore = !!append;
        this.hasError = false;
        this.hasPendingChanges = false;

        return queryRecords({
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
                this.hasMoreRecords = result.hasMore;
                this.hasLoadedOnce = true;
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
        (this.columns || []).forEach((column) => {
            if (column.fieldName && column.fieldName.includes('.')) {
                flattened[toAlias(column.fieldName)] = getNestedValue(record, column.fieldName);
            }
        });
        return flattened;
    }

    handleSort(event) {
        // lightning-datatable reports the flattened alias (Owner_Name); the server needs the real path.
        const reported = event.detail.fieldName;
        const column = (this.columns || []).find(
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
        const datatable = this.template.querySelector('lightning-datatable');
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
        this.dispatchEvent(new CustomEvent('bulkaction', { detail: { name, selectedRows: this.selectedRows } }));
    }

    async handleBulkDelete() {
        const count = this.selectedRows.length;
        const confirmed = await ConfirmDialog.open({
            label: 'Delete Records',
            message: `This will permanently delete ${count} record${count === 1 ? '' : 's'}. This cannot be undone.`,
            variant: 'destructive',
            confirmLabel: 'Delete'
        });
        if (!confirmed) {
            return;
        }

        const ids = this.selectedRows.map((row) => row[this.keyField]);
        this.isLoading = true;
        try {
            const results = await deleteRecords({ objectApiName: this.objectApiName, recordIds: ids });
            const succeededIds = results.filter((result) => result.success).map((result) => result.rowKey);
            const failed = results.filter((result) => !result.success);

            this.records = this.records.filter((record) => !succeededIds.includes(record[this.keyField]));
            this.totalCount = Math.max(0, this.totalCount - succeededIds.length);
            this.clearSelection();

            if (failed.length) {
                showErrorToast(
                    this,
                    `${succeededIds.length} deleted, ${failed.length} failed: ${failed.map((f) => f.message).join(' ')}`
                );
            } else {
                showSuccessToast(this, `${succeededIds.length} record${succeededIds.length === 1 ? '' : 's'} deleted.`);
            }
            if (succeededIds.length) {
                notifyRecordsChanged(succeededIds);
            }
        } catch (error) {
            showErrorToast(this, reduceApexErrors(error));
        } finally {
            this.isLoading = false;
            this.lastOwnWriteAt = Date.now();
        }
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

    async handleSave(event) {
        const draftValues = event.detail.draftValues;
        this.isLoading = true;
        const inputs = draftValues.map((draft) => this.buildSaveInput(draft));

        try {
            const results = await saveRecords({ objectApiName: this.objectApiName, records: inputs });
            // Whatever failed is kept in draftValues below; nothing else is still being edited.
            this.hasLocalEdits = false;
            const succeeded = results.filter((result) => result.success);
            const failed = results.filter((result) => !result.success);
            const modstampByRowKey = new Map(succeeded.filter((r) => r.modstamp != null).map((r) => [r.rowKey, r.modstamp]));

            if (succeeded.length) {
                const succeededRowKeys = new Set(succeeded.map((result) => result.rowKey));
                this.records = this.records.map((record) => {
                    const rowKey = record[this.keyField];
                    if (!succeededRowKeys.has(rowKey)) {
                        return record;
                    }
                    const draft = draftValues.find((d) => d[this.keyField] === rowKey);
                    const updated = { ...record, ...draft };
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
                const conflictNote = conflictCount
                    ? ` ${conflictCount} changed by someone else - refresh to see the latest.`
                    : '';
                showErrorToast(this, `${succeeded.length} saved, ${failed.length} failed.${conflictNote}`);
            } else {
                this.datatableErrors = {};
                this.draftValues = [];
                showSuccessToast(this, `${succeeded.length} record${succeeded.length === 1 ? '' : 's'} saved.`);
            }

            if (succeeded.length) {
                notifyRecordsChanged(succeeded.map((result) => result.rowKey));
            }
        } catch (error) {
            showErrorToast(this, reduceApexErrors(error));
        } finally {
            this.isLoading = false;
            this.lastOwnWriteAt = Date.now();
        }
    }

    handleCancelEdit() {
        this.hasLocalEdits = false;
        this.draftValues = [];
        this.datatableErrors = {};
    }
}

function toAlias(dottedFieldName) {
    return dottedFieldName.replace(/\./g, '_');
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
