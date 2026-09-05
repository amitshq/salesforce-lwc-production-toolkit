import { LightningElement, api } from 'lwc';

/**
 * Presentational error placeholder, used directly or via c-state-manager's
 * error slot default. Pass `details` (e.g. the output of
 * reduceApexErrors/reduceLdsErrors) to give power users/admins a way to see
 * the raw message without cluttering the default view.
 */
export default class ErrorState extends LightningElement {
    @api title = 'Something went wrong';
    @api message = '';
    @api hideRetry = false;
    @api retryLabel = 'Try Again';
    @api details = '';

    detailsExpanded = false;

    get showRetry() {
        return !this.hideRetry;
    }

    get hasDetails() {
        return !!this.details;
    }

    get toggleLabel() {
        return this.detailsExpanded ? 'Hide details' : 'Show details';
    }

    get detailsClass() {
        return this.detailsExpanded ? 'slds-box slds-theme_shade slds-m-top_small' : 'slds-hide';
    }

    handleRetryClick() {
        this.dispatchEvent(new CustomEvent('retry', { bubbles: true, composed: true }));
    }

    handleToggleDetails() {
        this.detailsExpanded = !this.detailsExpanded;
    }
}
