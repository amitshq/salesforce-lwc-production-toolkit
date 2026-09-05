import { LightningElement, api } from 'lwc';

/**
 * "N selected" toolbar for any multi-select list or grid, not just a
 * datatable - decoupled from c-enterprise-datatable so it's reusable on a
 * plain list view, a kanban board, or a related-list clone.
 *
 * @example
 * <c-bulk-action-bar
 *     selected-count={selectedRows.length}
 *     actions={bulkActions}
 *     onaction={handleBulkAction}
 *     onclear={handleClearSelection}
 * ></c-bulk-action-bar>
 *
 * // bulkActions = [{ name: 'delete', label: 'Delete', variant: 'destructive', iconName: 'utility:delete' }]
 */
export default class BulkActionBar extends LightningElement {
    @api selectedCount = 0;
    @api actions = [];
    @api clearLabel = 'Clear selection';

    get hasSelection() {
        return this.selectedCount > 0;
    }

    get countLabel() {
        return `${this.selectedCount} selected`;
    }

    handleActionClick(event) {
        const { name } = event.currentTarget.dataset;
        this.dispatchEvent(new CustomEvent('action', { detail: { name, selectedCount: this.selectedCount } }));
    }

    handleClearClick() {
        this.dispatchEvent(new CustomEvent('clear'));
    }
}
