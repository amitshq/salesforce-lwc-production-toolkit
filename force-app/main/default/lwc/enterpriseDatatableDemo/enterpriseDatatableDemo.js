import { LightningElement } from 'lwc';
import { exportRowsToCsv as downloadRowsAsCsv } from 'c/csvUtils';
import { getMetadataRecordByDeveloperName } from 'c/metadataUtils';
import { hasCustomPermission } from 'c/permissionUtils';
import { copyValue } from 'c/clipboardUtils';
import { showSuccessToast, showErrorToast } from 'c/toastService';

const FALLBACK_PAGE_SIZE = 25;

/**
 * Drop this on an App/Record/Home page (or embed it in your own LWC) to see
 * the whole toolkit wired together against Account:
 *  - c-enterprise-datatable for the query/page/sort/filter/edit pipeline
 *  - metadataUtils reading the page size from the ToolkitDemoSetting__mdt
 *    custom metadata record that ships with this package, instead of a
 *    hardcoded constant
 *  - permissionUtils gating the bulk-delete action on the
 *    Toolkit_Bulk_Edit custom permission, on top of the object-level
 *    isDeletable check c-enterprise-datatable already does itself
 *  - enable-conflict-detection, so an inline edit is rejected (not silently
 *    overwritten) if someone else changed the record after it was loaded
 *  - c-csv-import-wizard in a c-modal, refreshing the table when it finishes
 *  - c-aggregate-kpi-card tiles above the table, each computing its own
 *    COUNT/SUM/AVG through GenericAggregateService
 *  - enable-column-chooser and view-key, so each user can hide columns and
 *    save, reopen and default their own views (stored in ToolkitSavedView__c)
 *  - auto-refresh, so the table follows changes made elsewhere. It needs
 *    Change Data Capture enabled for Account (Setup > Integrations > Change
 *    Data Capture); without it the table just doesn't update live.
 *  - clipboardUtils behind a "Copy Ids" bulk action: the selected records' Ids
 *    go to the clipboard one per line, ready to paste into a report filter
 *  - the account name as a link to its record (still editable inline), Industry
 *    edited with a dropdown of its picklist values, and a View / Edit / Delete
 *    menu on each row; deletes can be undone
 *  - enable-mass-update ("Update field" on the selected rows), enable-export
 *    (every matching row to CSV) and a totals row summing annual revenue
 *  - c-aggregate-top-list ranking industries by revenue
 *  - the import wizard's "Check against Salesforce" dry run. It runs triggers and
 *    flows and rolls them back; leave it off where automation sends emails or
 *    publishes events, which a rollback does not undo.
 */
export default class EnterpriseDatatableDemo extends LightningElement {
    pageSize = FALLBACK_PAGE_SIZE;
    canBulkEdit = false;

    columns = [
        { label: 'Account Name', fieldName: 'Name', type: 'text', editable: true, filterable: true, linkToRecord: true },
        { label: 'Industry', fieldName: 'Industry', type: 'picklist', editable: true, filterable: true },
        { label: 'Phone', fieldName: 'Phone', type: 'phone', editable: true },
        { label: 'Owner', fieldName: 'Owner.Name', type: 'text' },
        { label: 'Annual Revenue', fieldName: 'AnnualRevenue', type: 'currency', editable: true }
    ];

    searchFields = ['Name', 'Industry'];

    totals = [{ fieldName: 'AnnualRevenue', functionName: 'SUM' }];

    technologyFilters = [{ fieldName: 'Industry', operatorName: '=', value: 'Technology' }];

    bulkActions = [
        { name: 'export', label: 'Export CSV', iconName: 'utility:download' },
        { name: 'copyIds', label: 'Copy Ids', iconName: 'utility:copy_to_clipboard' }
    ];

    importFields = [
        { apiName: 'Name', label: 'Account Name', type: 'text', required: true },
        { apiName: 'Industry', label: 'Industry', type: 'text' },
        { apiName: 'Phone', label: 'Phone', type: 'text' },
        { apiName: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency' }
    ];

    connectedCallback() {
        getMetadataRecordByDeveloperName('ToolkitDemoSetting__mdt', 'Default', ['DefaultPageSize__c'])
            .then((record) => {
                if (record?.DefaultPageSize__c) {
                    this.pageSize = record.DefaultPageSize__c;
                }
            })
            .catch(() => {
                // ToolkitDemoSetting__mdt.Default not deployed/visible - keep the built-in fallback.
            });

        hasCustomPermission('Toolkit_Bulk_Edit')
            .then((allowed) => {
                this.canBulkEdit = allowed;
            })
            .catch(() => {
                this.canBulkEdit = false;
            });
    }

    get enableBulkDelete() {
        return this.canBulkEdit;
    }

    handleImportClick() {
        this.template.querySelector('c-modal').open();
    }

    handleImportClose() {
        this.template.querySelector('c-csv-import-wizard').reset();
    }

    handleImportComplete() {
        this.template.querySelector('c-enterprise-datatable').refresh();
    }

    handleBulkAction(event) {
        const { name, selectedRows } = event.detail;
        if (name === 'export') {
            this.exportRowsToCsv(selectedRows);
        } else if (name === 'copyIds') {
            this.copyIds(selectedRows);
        }
    }

    exportRowsToCsv(rows) {
        downloadRowsAsCsv(rows, this.columns, 'accounts-export.csv');
    }

    // Called straight from the click, so the browser still treats the copy as user-initiated.
    async copyIds(rows) {
        const copied = await copyValue(rows.map((row) => row.Id));
        if (copied) {
            showSuccessToast(this, `${rows.length} Id${rows.length === 1 ? '' : 's'} copied to the clipboard`);
        } else {
            showErrorToast(this, 'Could not copy to the clipboard');
        }
    }
}
