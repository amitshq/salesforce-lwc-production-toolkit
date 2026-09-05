import { LightningElement, api } from 'lwc';

/**
 * Presentational "no data" placeholder, used directly or via
 * c-state-manager's empty slot default. An "actions" slot lets the caller
 * add a primary action (e.g. "Create Record") without forking the markup.
 */
export default class EmptyState extends LightningElement {
    @api title = 'Nothing to show';
    @api message = '';
    @api iconName = 'utility:open_folder';
}
