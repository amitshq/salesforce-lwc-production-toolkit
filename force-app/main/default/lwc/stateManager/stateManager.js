import { LightningElement, api } from 'lwc';

/**
 * The loading/error/empty/content branch every data-driven component ends
 * up writing by hand. One state wins at a time, checked in the order a user
 * actually cares about: a spinner beats a stale error, and an error beats
 * an "empty" message that's just wrong data anyway.
 *
 * Each state renders sensible default UI (c-empty-state / c-error-state /
 * lightning-spinner) that can be overridden per-instance via the named
 * "loading" / "error" / "empty" slots; the default slot renders the real
 * content once data is ready.
 *
 * @example
 * <c-state-manager is-loading={isLoading} has-error={hasError} error-message={errorMessage} is-empty={isEmpty}>
 *     <template for:each={rows} for:item="row">...</template>
 * </c-state-manager>
 */
export default class StateManager extends LightningElement {
    @api isLoading = false;
    @api hasError = false;
    @api errorMessage = '';
    @api isEmpty = false;
    @api loadingLabel = 'Loading...';
    @api emptyTitle = 'Nothing to show';
    @api emptyMessage = '';
    @api emptyIconName = 'utility:open_folder';

    get showLoading() {
        return this.isLoading;
    }

    get showError() {
        return !this.isLoading && this.hasError;
    }

    get showEmpty() {
        return !this.isLoading && !this.hasError && this.isEmpty;
    }

    get showContent() {
        return !this.isLoading && !this.hasError && !this.isEmpty;
    }
}
