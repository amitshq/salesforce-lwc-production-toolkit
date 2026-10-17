import { LightningElement, api } from 'lwc';
import getViews from '@salesforce/apex/SavedViewService.getViews';
import saveView from '@salesforce/apex/SavedViewService.saveView';
import setDefaultView from '@salesforce/apex/SavedViewService.setDefaultView';
import deleteView from '@salesforce/apex/SavedViewService.deleteView';
import { reduceApexErrors } from 'c/apexErrorUtils';
import { showSuccessToast, showErrorToast } from 'c/toastService';
import ConfirmDialog from 'c/confirmDialog';

// A combobox option cannot reliably use an empty string as its value.
const NO_VIEW = '__none__';

function parseConfig(text) {
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * The saved-views toolbar for c-enterprise-datatable: pick a view, save the
 * table's current layout as a new one, update or delete the selected one,
 * and choose which view opens by default. Views are private to each user and
 * stored by SavedViewService.
 *
 * It does not touch the table itself. It reports what happened through events
 * and is told the table's current settings through `currentConfig`:
 *  - `viewsready`  once, after the first load, with the default view's
 *                  settings (`config`, or null if there is none). The owner
 *                  should wait for it before its first query.
 *  - `viewselect`  when the user picks a view or "All records"; `config` is
 *                  null for "All records", meaning reset to the defaults.
 *
 * The settings are opaque here - whatever object the owner passes as
 * `currentConfig` is saved as JSON and handed back unchanged.
 *
 * @example
 * <c-datatable-view-bar
 *     view-key="accounts-main"
 *     object-api-name="Account"
 *     current-config={currentConfig}
 *     onviewsready={handleViewsReady}
 *     onviewselect={handleViewSelect}
 * ></c-datatable-view-bar>
 */
export default class DatatableViewBar extends LightningElement {
    @api viewKey;
    @api objectApiName;
    @api currentConfig;

    views = [];
    selectedId = NO_VIEW;
    isBusy = false;
    errorMessage = '';
    showSaveForm = false;
    saveName = '';
    saveAsDefault = false;
    readyDispatched = false;

    connectedCallback() {
        this.loadInitialViews();
    }

    get viewOptions() {
        return [
            { label: 'All records', value: NO_VIEW },
            ...this.views.map((view) => ({ label: view.isDefault ? `${view.name} (default)` : view.name, value: view.id }))
        ];
    }

    get selectedView() {
        return this.views.find((view) => view.id === this.selectedId);
    }

    get hasSelection() {
        return !!this.selectedView;
    }

    get isModified() {
        const view = this.selectedView;
        if (!view || !this.currentConfig) {
            return false;
        }
        const stored = parseConfig(view.config);
        return !stored || JSON.stringify(stored) !== JSON.stringify(this.currentConfig);
    }

    get defaultButtonLabel() {
        return this.selectedView && this.selectedView.isDefault ? 'Remove default' : 'Make default';
    }

    get hasError() {
        return !!this.errorMessage;
    }

    get saveDisabled() {
        return this.isBusy || !this.saveName.trim();
    }

    async loadInitialViews() {
        this.isBusy = true;
        let defaultView = null;
        let defaultConfig = null;
        try {
            this.views = await getViews({ viewKey: this.viewKey });
            defaultView = this.views.find((view) => view.isDefault) || null;
            defaultConfig = defaultView ? parseConfig(defaultView.config) : null;
            if (defaultConfig) {
                this.selectedId = defaultView.id;
            }
        } catch (error) {
            this.errorMessage = reduceApexErrors(error).join(' ');
        } finally {
            this.isBusy = false;
        }
        // Always tell the owner, even after a failure, or its table would never load.
        if (!this.readyDispatched) {
            this.readyDispatched = true;
            this.dispatchEvent(
                new CustomEvent('viewsready', {
                    detail: { viewId: defaultConfig ? defaultView.id : null, config: defaultConfig }
                })
            );
        }
    }

    handleSelect(event) {
        const viewId = event.detail.value;
        this.errorMessage = '';
        this.selectedId = viewId;
        const view = this.selectedView;
        this.dispatchEvent(
            new CustomEvent('viewselect', {
                detail: { viewId: view ? view.id : null, config: view ? parseConfig(view.config) : null }
            })
        );
    }

    handleSaveNewClick() {
        this.showSaveForm = true;
        this.saveName = '';
        this.saveAsDefault = false;
        this.errorMessage = '';
    }

    handleSaveCancel() {
        this.showSaveForm = false;
    }

    handleNameChange(event) {
        this.saveName = event.target.value || '';
    }

    handleDefaultCheckboxChange(event) {
        this.saveAsDefault = event.target.checked;
    }

    async handleSaveSubmit() {
        const name = this.saveName.trim();
        if (!name) {
            return;
        }
        const existing = this.views.find((view) => view.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            const confirmed = await ConfirmDialog.open({
                label: 'Replace view',
                message: `You already have a view named "${existing.name}". Replace its settings with the table's current ones?`,
                confirmLabel: 'Replace'
            });
            if (!confirmed) {
                return;
            }
        }
        const saved = await this.persist({ name, makeDefault: this.saveAsDefault, viewId: null }, 'View saved.');
        if (saved) {
            this.showSaveForm = false;
        }
    }

    async handleUpdate() {
        const view = this.selectedView;
        if (view) {
            await this.persist({ name: view.name, makeDefault: null, viewId: view.id }, 'View updated.');
        }
    }

    async handleToggleDefault() {
        const view = this.selectedView;
        if (!view) {
            return;
        }
        await this.run(async () => {
            this.views = await setDefaultView({ viewKey: this.viewKey, viewId: view.isDefault ? null : view.id });
            showSuccessToast(this, view.isDefault ? 'Default view removed.' : `"${view.name}" will open by default.`);
        });
    }

    async handleDelete() {
        const view = this.selectedView;
        if (!view) {
            return;
        }
        const confirmed = await ConfirmDialog.open({
            label: 'Delete view',
            message: `Delete the view "${view.name}"? This cannot be undone.`,
            variant: 'destructive',
            confirmLabel: 'Delete'
        });
        if (!confirmed) {
            return;
        }
        await this.run(async () => {
            await deleteView({ viewId: view.id });
            this.views = this.views.filter((candidate) => candidate.id !== view.id);
            // The table keeps showing what it shows; it just no longer matches a saved view.
            this.selectedId = NO_VIEW;
            showSuccessToast(this, 'View deleted.');
        });
    }

    async persist({ name, makeDefault, viewId }, successMessage) {
        if (!this.currentConfig) {
            this.errorMessage = 'There is nothing to save yet.';
            return false;
        }
        return this.run(async () => {
            const saved = await saveView({
                viewKey: this.viewKey,
                objectApiName: this.objectApiName,
                name,
                config: JSON.stringify(this.currentConfig),
                makeDefault,
                viewId
            });
            // Re-read the list: saving a default changes the flag on another view too.
            this.views = await getViews({ viewKey: this.viewKey });
            this.selectedId = saved.id;
            showSuccessToast(this, successMessage);
        });
    }

    /** Runs a server action with the busy flag and error display. Resolves true on success. */
    async run(action) {
        this.isBusy = true;
        this.errorMessage = '';
        try {
            await action();
            return true;
        } catch (error) {
            this.errorMessage = reduceApexErrors(error).join(' ');
            showErrorToast(this, this.errorMessage);
            return false;
        } finally {
            this.isBusy = false;
        }
    }
}
