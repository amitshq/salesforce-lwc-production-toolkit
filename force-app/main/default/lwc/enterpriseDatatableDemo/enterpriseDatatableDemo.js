import { LightningElement } from 'lwc';
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

    bulkActions = [{ name: 'export', label: 'Export CSV', iconName: 'utility:download' }];

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

    handleBulkAction(event) {
        const { name, selectedRows } = event.detail;
        if (name === 'export') {
            this.exportRowsToCsv(selectedRows);
        }
    }

    // Illustrative only - swap in a real CSV export utility for production use.
    exportRowsToCsv(rows) {
        const header = this.columns.map((column) => column.label).join(',');
        const lines = rows.map((row) => this.columns.map((column) => row[column.fieldName.replace(/\./g, '_')] ?? '').join(','));
        // eslint-disable-next-line no-console
        console.log([header, ...lines].join('\n'));
    }
}
