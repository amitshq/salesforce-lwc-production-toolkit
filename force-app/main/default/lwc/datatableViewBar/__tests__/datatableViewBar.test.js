import { createElement } from 'lwc';
import DatatableViewBar from 'c/datatableViewBar';
import getViews from '@salesforce/apex/SavedViewService.getViews';
import saveView from '@salesforce/apex/SavedViewService.saveView';
import setDefaultView from '@salesforce/apex/SavedViewService.setDefaultView';
import deleteView from '@salesforce/apex/SavedViewService.deleteView';
import ConfirmDialog from 'c/confirmDialog';

jest.mock('@salesforce/apex/SavedViewService.getViews', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SavedViewService.saveView', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SavedViewService.setDefaultView', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SavedViewService.deleteView', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('c/confirmDialog', () => ({
    __esModule: true,
    default: { open: jest.fn() }
}));

const CONFIG_A = { v: 1, columns: ['Name'], sortedBy: 'Name', sortedDirection: 'asc', searchTerm: '', columnFilters: {} };
const CONFIG_B = { v: 1, columns: null, sortedBy: 'Industry', sortedDirection: 'desc', searchTerm: 'acme', columnFilters: {} };

function view(id, name, config, isDefault = false) {
    return { id, name, config: JSON.stringify(config), isDefault };
}

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createBar(props = {}, listeners = {}) {
    const element = createElement('c-datatable-view-bar', { is: DatatableViewBar });
    Object.assign(element, { viewKey: 'accounts-main', objectApiName: 'Account', currentConfig: CONFIG_A, ...props });
    Object.keys(listeners).forEach((name) => element.addEventListener(name, listeners[name]));
    document.body.appendChild(element);
    return element;
}

function combobox(element) {
    return element.shadowRoot.querySelector('lightning-combobox');
}

function button(element, label) {
    return Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((b) => b.label === label);
}

// `label` is a component property, not a reflected attribute, so a CSS attribute selector cannot find it.
function inputByLabel(element, label) {
    return Array.from(element.shadowRoot.querySelectorAll('lightning-input')).find((input) => input.label === label) || null;
}

function text(element) {
    return element.shadowRoot.textContent;
}

async function openSaveForm(element) {
    button(element, 'Save as new view').click();
    await flushPromises();
}

async function typeName(element, value) {
    const input = inputByLabel(element, 'View name');
    input.value = value;
    input.dispatchEvent(new CustomEvent('change'));
    await flushPromises();
}

describe('c-datatable-view-bar', () => {
    beforeEach(() => {
        ConfirmDialog.open.mockResolvedValue(true);
    });

    afterEach(() => {
        jest.resetAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    describe('loading', () => {
        it('loads this table\'s views and lists them after "All records"', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A), view('v2', 'Tech', CONFIG_B, true)]);
            const element = createBar();
            await flushPromises();

            expect(getViews).toHaveBeenCalledWith({ viewKey: 'accounts-main' });
            expect(combobox(element).options).toEqual([
                { label: 'All records', value: '__none__' },
                { label: 'Big accounts', value: 'v1' },
                { label: 'Tech (default)', value: 'v2' }
            ]);
        });

        it('announces the default view\'s settings once and selects it', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A), view('v2', 'Tech', CONFIG_B, true)]);
            const ready = jest.fn();
            const element = createBar({}, { viewsready: ready });
            await flushPromises();

            expect(ready).toHaveBeenCalledTimes(1);
            expect(ready.mock.calls[0][0].detail).toEqual({ viewId: 'v2', config: CONFIG_B });
            expect(combobox(element).value).toBe('v2');
        });

        it('announces no config when there is no default view', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A)]);
            const ready = jest.fn();
            const element = createBar({}, { viewsready: ready });
            await flushPromises();

            expect(ready.mock.calls[0][0].detail).toEqual({ viewId: null, config: null });
            expect(combobox(element).value).toBe('__none__');
        });

        it('still announces readiness when loading fails, and shows why', async () => {
            getViews.mockRejectedValue({ body: { message: 'No access to ToolkitSavedView__c.' } });
            const ready = jest.fn();
            const element = createBar({}, { viewsready: ready });
            await flushPromises();

            expect(ready).toHaveBeenCalledTimes(1);
            expect(ready.mock.calls[0][0].detail.config).toBeNull();
            expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('No access to ToolkitSavedView__c.');
        });

        it('does not apply a default whose stored settings are unreadable', async () => {
            getViews.mockResolvedValue([{ id: 'v1', name: 'Broken', config: '{oops', isDefault: true }]);
            const ready = jest.fn();
            const element = createBar({}, { viewsready: ready });
            await flushPromises();

            expect(ready.mock.calls[0][0].detail).toEqual({ viewId: null, config: null });
            expect(combobox(element).value).toBe('__none__');
        });
    });

    describe('choosing a view', () => {
        it('reports the chosen view\'s settings', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A), view('v2', 'Tech', CONFIG_B)]);
            const selected = jest.fn();
            const element = createBar({}, { viewselect: selected });
            await flushPromises();

            combobox(element).dispatchEvent(new CustomEvent('change', { detail: { value: 'v2' } }));
            await flushPromises();

            expect(selected.mock.calls[0][0].detail).toEqual({ viewId: 'v2', config: CONFIG_B });
        });

        it('reports null settings for "All records", meaning reset', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A, true)]);
            const selected = jest.fn();
            const element = createBar({}, { viewselect: selected });
            await flushPromises();

            combobox(element).dispatchEvent(new CustomEvent('change', { detail: { value: '__none__' } }));
            await flushPromises();

            expect(selected.mock.calls[0][0].detail).toEqual({ viewId: null, config: null });
        });
    });

    describe('unsaved changes', () => {
        it('offers "Update view" when the table no longer matches the selected view', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A, true)]);
            const element = createBar({ currentConfig: { ...CONFIG_A, searchTerm: 'changed' } });
            await flushPromises();

            expect(text(element)).toContain('Unsaved changes');
            expect(button(element, 'Update view')).toBeDefined();
        });

        it('stays quiet while the table matches the selected view', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A, true)]);
            const element = createBar({ currentConfig: CONFIG_A });
            await flushPromises();

            expect(text(element)).not.toContain('Unsaved changes');
            expect(button(element, 'Update view')).toBeUndefined();
        });

        it('has nothing to compare when no view is selected', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A)]);
            const element = createBar();
            await flushPromises();

            expect(text(element)).not.toContain('Unsaved changes');
        });

        it('updates the selected view in place, keeping its name and default flag', async () => {
            const changed = { ...CONFIG_A, searchTerm: 'changed' };
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A, true)]);
            saveView.mockResolvedValue({ id: 'v1' });
            const element = createBar({ currentConfig: changed });
            await flushPromises();

            button(element, 'Update view').click();
            await flushPromises();

            expect(saveView).toHaveBeenCalledWith({
                viewKey: 'accounts-main',
                objectApiName: 'Account',
                name: 'Big accounts',
                config: JSON.stringify(changed),
                makeDefault: null,
                viewId: 'v1'
            });
        });
    });

    describe('saving a new view', () => {
        it('needs a name before it can be saved', async () => {
            getViews.mockResolvedValue([]);
            const element = createBar();
            await flushPromises();
            await openSaveForm(element);

            expect(button(element, 'Save view').disabled).toBe(true);
            await typeName(element, 'My view');
            expect(button(element, 'Save view').disabled).toBe(false);
        });

        it('saves the table\'s current settings, refreshes the list and selects the new view', async () => {
            getViews.mockResolvedValueOnce([]).mockResolvedValueOnce([view('new1', 'My view', CONFIG_A)]);
            saveView.mockResolvedValue({ id: 'new1' });
            const element = createBar();
            await flushPromises();
            await openSaveForm(element);
            await typeName(element, '  My view  ');

            button(element, 'Save view').click();
            await flushPromises();

            expect(saveView).toHaveBeenCalledWith({
                viewKey: 'accounts-main',
                objectApiName: 'Account',
                name: 'My view',
                config: JSON.stringify(CONFIG_A),
                makeDefault: false,
                viewId: null
            });
            expect(getViews).toHaveBeenCalledTimes(2);
            expect(combobox(element).value).toBe('new1');
            expect(inputByLabel(element, 'View name')).toBeNull();
        });

        it('can make the new view the default', async () => {
            getViews.mockResolvedValue([]);
            saveView.mockResolvedValue({ id: 'new1' });
            const element = createBar();
            await flushPromises();
            await openSaveForm(element);
            await typeName(element, 'Mine');
            const checkbox = inputByLabel(element, 'Open this view by default');
            checkbox.checked = true;
            checkbox.dispatchEvent(new CustomEvent('change'));
            await flushPromises();

            button(element, 'Save view').click();
            await flushPromises();

            expect(saveView.mock.calls[0][0].makeDefault).toBe(true);
        });

        it('asks before replacing a view that has the same name, and stops if declined', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A)]);
            ConfirmDialog.open.mockResolvedValue(false);
            const element = createBar();
            await flushPromises();
            await openSaveForm(element);
            await typeName(element, 'big ACCOUNTS');

            button(element, 'Save view').click();
            await flushPromises();

            expect(ConfirmDialog.open).toHaveBeenCalledTimes(1);
            expect(ConfirmDialog.open.mock.calls[0][0].message).toContain('Big accounts');
            expect(saveView).not.toHaveBeenCalled();
        });

        it('keeps the form open and shows the reason when the server refuses', async () => {
            getViews.mockResolvedValue([]);
            saveView.mockRejectedValue({ body: { message: 'You can keep at most 50 views per table. Delete one first.' } });
            const element = createBar();
            await flushPromises();
            await openSaveForm(element);
            await typeName(element, 'One too many');

            button(element, 'Save view').click();
            await flushPromises();

            expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('at most 50 views');
            expect(inputByLabel(element, 'View name')).not.toBeNull();
        });

        it('closes the form on Cancel without saving', async () => {
            getViews.mockResolvedValue([]);
            const element = createBar();
            await flushPromises();
            await openSaveForm(element);

            button(element, 'Cancel').click();
            await flushPromises();

            expect(inputByLabel(element, 'View name')).toBeNull();
            expect(saveView).not.toHaveBeenCalled();
        });
    });

    describe('the default view', () => {
        it('makes the selected view the default', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A)]);
            setDefaultView.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A, true)]);
            const element = createBar();
            await flushPromises();
            combobox(element).dispatchEvent(new CustomEvent('change', { detail: { value: 'v1' } }));
            await flushPromises();

            button(element, 'Make default').click();
            await flushPromises();

            expect(setDefaultView).toHaveBeenCalledWith({ viewKey: 'accounts-main', viewId: 'v1' });
            expect(combobox(element).options[1].label).toBe('Big accounts (default)');
            expect(button(element, 'Remove default')).toBeDefined();
        });

        it('clears the default when the selected view already is one', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A, true)]);
            setDefaultView.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A, false)]);
            const element = createBar({ currentConfig: CONFIG_A });
            await flushPromises();

            button(element, 'Remove default').click();
            await flushPromises();

            expect(setDefaultView).toHaveBeenCalledWith({ viewKey: 'accounts-main', viewId: null });
        });
    });

    describe('deleting', () => {
        it('deletes the selected view after confirmation and falls back to "All records"', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A, true), view('v2', 'Tech', CONFIG_B)]);
            deleteView.mockResolvedValue(undefined);
            const element = createBar({ currentConfig: CONFIG_A });
            await flushPromises();

            button(element, 'Delete view').click();
            await flushPromises();

            expect(ConfirmDialog.open.mock.calls[0][0].variant).toBe('destructive');
            expect(deleteView).toHaveBeenCalledWith({ viewId: 'v1' });
            expect(combobox(element).options.map((o) => o.value)).toEqual(['__none__', 'v2']);
            expect(combobox(element).value).toBe('__none__');
        });

        it('does nothing when the confirmation is declined', async () => {
            getViews.mockResolvedValue([view('v1', 'Big accounts', CONFIG_A, true)]);
            ConfirmDialog.open.mockResolvedValue(false);
            const element = createBar({ currentConfig: CONFIG_A });
            await flushPromises();

            button(element, 'Delete view').click();
            await flushPromises();

            expect(deleteView).not.toHaveBeenCalled();
            expect(combobox(element).options).toHaveLength(2);
        });
    });
});
