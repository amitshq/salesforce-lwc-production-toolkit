import { LightningElement } from 'lwc';
import { exportRowsToCsv as downloadRowsAsCsv } from 'c/csvUtils';
import { getMetadataRecordByDeveloperName } from 'c/metadataUtils';
import { hasCustomPermission } from 'c/permissionUtils';

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
 */
export default class EnterpriseDatatableDemo extends LightningElement {
    pageSize = FALLBACK_PAGE_SIZE;
    canBulkEdit = false;

    columns = [
        { label: 'Account Name', fieldName: 'Name', type: 'text', editable: true, filterable: true },
        { label: 'Industry', fieldName: 'Industry', type: 'text', editable: true, filterable: true },
        { label: 'Phone', fieldName: 'Phone', type: 'phone', editable: true },
        { label: 'Owner', fieldName: 'Owner.Name', type: 'text' },
        { label: 'Annual Revenue', fieldName: 'AnnualRevenue', type: 'currency', editable: true }
    ];

    searchFields = ['Name', 'Industry'];

    technologyFilters = [{ fieldName: 'Industry', operatorName: '=', value: 'Technology' }];

    bulkActions = [{ name: 'export', label: 'Export CSV', iconName: 'utility:download' }];

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
        }
    }

    exportRowsToCsv(rows) {
        downloadRowsAsCsv(rows, this.columns, 'accounts-export.csv');
    }
}
