import { createElement } from 'lwc';
import EnterpriseDatatable from 'c/enterpriseDatatable';
import queryRecords from '@salesforce/apex/GenericQueryService.query';
import saveRecords from '@salesforce/apex/GenericDmlService.saveRecords';
import deleteRecords from '@salesforce/apex/GenericDmlService.deleteRecords';
import getViews from '@salesforce/apex/SavedViewService.getViews';
import { getObjectAccess } from 'c/permissionUtils';
import { notifyRecordsChanged } from 'c/recordUtils';
import ConfirmDialog from 'c/confirmDialog';

jest.mock('@salesforce/apex/GenericQueryService.query', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/GenericDmlService.saveRecords', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/GenericDmlService.deleteRecords', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SavedViewService.getViews', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SavedViewService.saveView', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SavedViewService.setDefaultView', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/SavedViewService.deleteView', () => ({ default: jest.fn() }), { virtual: true });

jest.mock('c/permissionUtils', () => ({
    getObjectAccess: jest.fn(() => Promise.resolve({ isAccessible: true, isCreateable: true, isUpdateable: true, isDeletable: true }))
}));

jest.mock('c/recordUtils', () => ({
    notifyRecordsChanged: jest.fn(() => Promise.resolve())
}));

jest.mock('c/confirmDialog', () => ({
    __esModule: true,
    default: { open: jest.fn(() => Promise.resolve(true)) }
}));

const COLUMNS = [
    { label: 'Name', fieldName: 'Name', type: 'text', editable: true, filterable: true },
    { label: 'Industry', fieldName: 'Industry', type: 'text' }
];

const SAMPLE_ROW = { Id: '001', Name: 'Acme', Industry: 'Tech', Phone: '555-0100' };

function queryResult(records, overrides = {}) {
    return { records, totalCount: records.length, pageNumber: 1, pageSize: 25, hasMore: false, ...overrides };
}

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createDatatable(props = {}) {
    const element = createElement('c-enterprise-datatable', { is: EnterpriseDatatable });
    element.objectApiName = 'Account';
    element.columns = COLUMNS;
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-enterprise-datatable', () => {
    afterEach(() => {
        jest.clearAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('queries on connect with fields derived from columns plus the key field', async () => {
        queryRecords.mockResolvedValue(queryResult([{ Id: '001', Name: 'Acme', Industry: 'Tech' }]));
        createDatatable();
        await flushPromises();

        expect(queryRecords).toHaveBeenCalledWith(
            expect.objectContaining({
                objectApiName: 'Account',
                fields: expect.arrayContaining(['Id', 'Name', 'Industry']),
                pageNumber: 1,
                pageSize: 25
            })
        );
    });

    it('renders returned records into lightning-datatable', async () => {
        queryRecords.mockResolvedValue(queryResult([{ Id: '001', Name: 'Acme', Industry: 'Tech' }]));
        const element = createDatatable();
        await flushPromises();

        const datatable = element.shadowRoot.querySelector('lightning-datatable');
        expect(datatable.data).toEqual([{ Id: '001', Name: 'Acme', Industry: 'Tech' }]);
    });

    it('flattens relationship-path columns onto an alias key for the datatable', async () => {
        queryRecords.mockResolvedValue(
            queryResult([{ Id: '001', Name: 'Acme', Owner: { Name: 'Jane' } }])
        );
        const element = createDatatable({ columns: [...COLUMNS, { label: 'Owner', fieldName: 'Owner.Name' }] });
        await flushPromises();

        const datatable = element.shadowRoot.querySelector('lightning-datatable');
        expect(datatable.data[0].Owner_Name).toBe('Jane');
        expect(datatable.columns.find((c) => c.label === 'Owner').fieldName).toBe('Owner_Name');
    });

    it('shows the empty state when a query returns no rows', async () => {
        queryRecords.mockResolvedValue(queryResult([]));
        const element = createDatatable();
        await flushPromises();

        const stateManager = element.shadowRoot.querySelector('c-state-manager');
        expect(stateManager.shadowRoot.querySelector('c-empty-state')).not.toBeNull();
    });

    it('surfaces a query failure via the error state', async () => {
        queryRecords.mockRejectedValue({ body: { message: 'Unknown object: Foo__x' } });
        const element = createDatatable();
        await flushPromises();

        const stateManager = element.shadowRoot.querySelector('c-state-manager');
        const errorState = stateManager.shadowRoot.querySelector('c-error-state');
        expect(errorState).not.toBeNull();
        expect(errorState.message).toBe('Unknown object: Foo__x');
    });

    it('re-queries at page 1 with the new sort when a column header is sorted', async () => {
        queryRecords.mockResolvedValue(queryResult([{ Id: '001', Name: 'Acme' }]));
        const element = createDatatable();
        await flushPromises();
        queryRecords.mockClear();

        const datatable = element.shadowRoot.querySelector('lightning-datatable');
        datatable.dispatchEvent(new CustomEvent('sort', { detail: { fieldName: 'Name', sortDirection: 'desc' } }));
        await flushPromises();

        expect(queryRecords).toHaveBeenCalledWith(
            expect.objectContaining({ sortField: 'Name', sortDirection: 'desc', pageNumber: 1 })
        );
    });

    it('advances to the next page and back without exceeding the bounds', async () => {
        queryRecords.mockResolvedValue(queryResult([{ Id: '001' }], { totalCount: 30, pageSize: 25, pageNumber: 1, hasMore: true }));
        const element = createDatatable();
        await flushPromises();

        const nextButton = element.shadowRoot.querySelectorAll('lightning-button')[1];
        queryRecords.mockResolvedValue(queryResult([{ Id: '002' }], { totalCount: 30, pageSize: 25, pageNumber: 2, hasMore: false }));
        nextButton.click();
        await flushPromises();

        expect(queryRecords).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2 }));

        const buttons = element.shadowRoot.querySelectorAll('lightning-button');
        expect(buttons[1].disabled).toBe(true); // now on the last page
        expect(buttons[0].disabled).toBe(false); // Previous is now enabled
    });

    it('on save: merges successful rows and clears draft values', async () => {
        queryRecords.mockResolvedValue(queryResult([{ Id: '001', Name: 'Old Name' }]));
        const element = createDatatable();
        await flushPromises();

        saveRecords.mockResolvedValue([{ rowKey: '001', recordId: '001', success: true, message: null, fieldNames: null }]);
        const datatable = element.shadowRoot.querySelector('lightning-datatable');
        datatable.dispatchEvent(new CustomEvent('save', { detail: { draftValues: [{ Id: '001', Name: 'New Name' }] } }));
        await flushPromises();

        expect(element.shadowRoot.querySelector('lightning-datatable').data[0].Name).toBe('New Name');
        expect(element.shadowRoot.querySelector('lightning-datatable').draftValues).toEqual([]);
        expect(notifyRecordsChanged).toHaveBeenCalledWith(['001']);
    });

    it('on save: keeps failed rows as drafts and reports them via datatable errors', async () => {
        queryRecords.mockResolvedValue(queryResult([{ Id: '001', Name: 'Old Name' }]));
        const element = createDatatable();
        await flushPromises();

        saveRecords.mockResolvedValue([
            { rowKey: '001', recordId: null, success: false, message: 'Validation failed', fieldNames: ['Name'] }
        ]);
        const datatable = element.shadowRoot.querySelector('lightning-datatable');
        datatable.dispatchEvent(new CustomEvent('save', { detail: { draftValues: [{ Id: '001', Name: 'Bad Name' }] } }));
        await flushPromises();

        const updatedDatatable = element.shadowRoot.querySelector('lightning-datatable');
        expect(updatedDatatable.draftValues).toEqual([{ Id: '001', Name: 'Bad Name' }]);
        expect(updatedDatatable.errors.rows['001'].messages).toEqual(['Validation failed']);
    });

    it('does not offer bulk delete until the object access check resolves as deletable', async () => {
        getObjectAccess.mockResolvedValueOnce({ isDeletable: false });
        queryRecords.mockResolvedValue(queryResult([{ Id: '001' }]));
        const element = createDatatable({ enableBulkDelete: true });
        await flushPromises();

        const bulkBar = element.shadowRoot.querySelector('c-bulk-action-bar');
        expect(bulkBar.actions.some((a) => a.name === '__bulkDelete')).toBe(false);
    });

    it('bulk delete: does nothing if the confirmation dialog is dismissed', async () => {
        ConfirmDialog.open.mockResolvedValueOnce(false);
        queryRecords.mockResolvedValue(queryResult([{ Id: '001' }]));
        const element = createDatatable({ enableBulkDelete: true });
        await flushPromises();

        const bulkBar = element.shadowRoot.querySelector('c-bulk-action-bar');
        bulkBar.dispatchEvent(new CustomEvent('action', { detail: { name: '__bulkDelete' } }));
        await flushPromises();

        expect(deleteRecords).not.toHaveBeenCalled();
    });

    it('bulk delete: removes deleted rows and notifies LDS after confirmation', async () => {
        queryRecords.mockResolvedValue(queryResult([{ Id: '001' }, { Id: '002' }], { totalCount: 2 }));
        const element = createDatatable({ enableBulkDelete: true });
        await flushPromises();

        const datatable = element.shadowRoot.querySelector('lightning-datatable');
        datatable.dispatchEvent(new CustomEvent('rowselection', { detail: { selectedRows: [{ Id: '001' }] } }));
        await flushPromises();

        deleteRecords.mockResolvedValue([{ rowKey: '001', recordId: '001', success: true, message: null }]);
        const bulkBar = element.shadowRoot.querySelector('c-bulk-action-bar');
        bulkBar.dispatchEvent(new CustomEvent('action', { detail: { name: '__bulkDelete' } }));
        await flushPromises();
        await flushPromises();

        expect(deleteRecords).toHaveBeenCalledWith({ objectApiName: 'Account', recordIds: ['001'] });
        expect(element.shadowRoot.querySelector('lightning-datatable').data).toEqual([{ Id: '002' }]);
        expect(notifyRecordsChanged).toHaveBeenCalledWith(['001']);
    });

    it('an unrecognized bulk action is re-emitted for the parent to handle', async () => {
        queryRecords.mockResolvedValue(queryResult([{ Id: '001' }]));
        const element = createDatatable({ bulkActions: [{ name: 'export', label: 'Export' }] });
        await flushPromises();

        const bulkActionHandler = jest.fn();
        element.addEventListener('bulkaction', bulkActionHandler);

        const datatable = element.shadowRoot.querySelector('lightning-datatable');
        datatable.dispatchEvent(new CustomEvent('rowselection', { detail: { selectedRows: [{ Id: '001' }] } }));
        await flushPromises();

        const bulkBar = element.shadowRoot.querySelector('c-bulk-action-bar');
        bulkBar.dispatchEvent(new CustomEvent('action', { detail: { name: 'export' } }));
        await flushPromises();

        expect(bulkActionHandler).toHaveBeenCalledWith(
            expect.objectContaining({ detail: { name: 'export', selectedRows: [{ Id: '001' }] } })
        );
    });

    it('refresh() re-queries and clears selection/draft state', async () => {
        queryRecords.mockResolvedValue(queryResult([{ Id: '001' }]));
        const element = createDatatable();
        await flushPromises();
        queryRecords.mockClear();
        queryRecords.mockResolvedValue(queryResult([{ Id: '001' }]));

        await element.refresh();

        expect(queryRecords).toHaveBeenCalledTimes(1);
        expect(element.shadowRoot.querySelector('lightning-datatable').selectedRows).toEqual([]);
    });

    describe('conflict detection', () => {
        const LOADED_AT = '2024-01-01T00:00:00.000Z';

        function saveDraft(element, draft) {
            const datatable = element.shadowRoot.querySelector('lightning-datatable');
            datatable.dispatchEvent(new CustomEvent('save', { detail: { draftValues: [draft] } }));
            return flushPromises();
        }

        it('does not query SystemModstamp unless enabled', async () => {
            queryRecords.mockResolvedValue(queryResult([{ Id: '001', Name: 'Acme' }]));
            createDatatable();
            await flushPromises();

            expect(queryRecords.mock.calls[0][0].fields).not.toContain('SystemModstamp');
        });

        it('queries SystemModstamp when enabled', async () => {
            queryRecords.mockResolvedValue(queryResult([{ Id: '001', Name: 'Acme', SystemModstamp: LOADED_AT }]));
            createDatatable({ enableConflictDetection: true });
            await flushPromises();

            expect(queryRecords.mock.calls[0][0].fields).toContain('SystemModstamp');
        });

        it('sends the loaded SystemModstamp as expectedModstamp on save', async () => {
            queryRecords.mockResolvedValue(queryResult([{ Id: '001', Name: 'Acme', SystemModstamp: LOADED_AT }]));
            const element = createDatatable({ enableConflictDetection: true });
            await flushPromises();
            saveRecords.mockResolvedValue([{ rowKey: '001', success: true }]);

            await saveDraft(element, { Id: '001', Name: 'New' });

            expect(saveRecords).toHaveBeenCalledWith({
                objectApiName: 'Account',
                records: [{ rowKey: '001', fields: { Id: '001', Name: 'New' }, expectedModstamp: Date.parse(LOADED_AT) }]
            });
        });

        it('does not send expectedModstamp when disabled', async () => {
            queryRecords.mockResolvedValue(queryResult([{ Id: '001', Name: 'Acme', SystemModstamp: LOADED_AT }]));
            const element = createDatatable();
            await flushPromises();
            saveRecords.mockResolvedValue([{ rowKey: '001', success: true }]);

            await saveDraft(element, { Id: '001', Name: 'New' });

            expect(saveRecords.mock.calls[0][0].records[0]).not.toHaveProperty('expectedModstamp');
        });

        it('uses the modstamp returned by a successful save for the next edit of that row', async () => {
            queryRecords.mockResolvedValue(queryResult([{ Id: '001', Name: 'Acme', SystemModstamp: LOADED_AT }]));
            const element = createDatatable({ enableConflictDetection: true });
            await flushPromises();

            saveRecords.mockResolvedValueOnce([{ rowKey: '001', success: true, modstamp: 1700000000000 }]);
            await saveDraft(element, { Id: '001', Name: 'First' });
            saveRecords.mockResolvedValueOnce([{ rowKey: '001', success: true, modstamp: 1700000005000 }]);
            await saveDraft(element, { Id: '001', Name: 'Second' });

            expect(saveRecords.mock.calls[1][0].records[0].expectedModstamp).toBe(1700000000000);
        });

        it('keeps a conflicting row as a draft with its error and says it was changed by someone else', async () => {
            queryRecords.mockResolvedValue(queryResult([{ Id: '001', Name: 'Acme', SystemModstamp: LOADED_AT }]));
            const element = createDatatable({ enableConflictDetection: true });
            await flushPromises();
            const toastHandler = jest.fn();
            element.addEventListener('lightning__showtoast', toastHandler);
            saveRecords.mockResolvedValue([
                { rowKey: '001', success: false, isConflict: true, message: 'This record was changed by someone else.' }
            ]);

            await saveDraft(element, { Id: '001', Name: 'Mine' });

            const datatable = element.shadowRoot.querySelector('lightning-datatable');
            expect(datatable.draftValues).toEqual([{ Id: '001', Name: 'Mine' }]);
            expect(datatable.errors.rows['001'].messages).toEqual(['This record was changed by someone else.']);
            expect(toastHandler.mock.calls[0][0].detail.message).toContain('1 changed by someone else');
        });
    });

    describe('sorting a relationship column', () => {
        it('shows the flattened alias in the header but sends the real path to the server', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({
                columns: [...COLUMNS, { label: 'Owner', fieldName: 'Owner.Name', type: 'text', sortable: true }]
            });
            await flushPromises();

            const datatable = element.shadowRoot.querySelector('lightning-datatable');
            datatable.dispatchEvent(new CustomEvent('sort', { detail: { fieldName: 'Owner_Name', sortDirection: 'desc' } }));
            await flushPromises();

            expect(queryRecords).toHaveBeenLastCalledWith(expect.objectContaining({ sortField: 'Owner.Name', sortDirection: 'desc' }));
            expect(element.shadowRoot.querySelector('lightning-datatable').sortedBy).toBe('Owner_Name');
        });

        it('shows a default sort on a relationship column against its alias', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({
                columns: [...COLUMNS, { label: 'Owner', fieldName: 'Owner.Name', type: 'text', sortable: true }],
                defaultSortField: 'Owner.Name'
            });
            await flushPromises();

            expect(queryRecords).toHaveBeenCalledWith(expect.objectContaining({ sortField: 'Owner.Name' }));
            expect(element.shadowRoot.querySelector('lightning-datatable').sortedBy).toBe('Owner_Name');
        });
    });

    describe('column chooser', () => {
        const THREE_COLUMNS = [...COLUMNS, { label: 'Phone', fieldName: 'Phone', type: 'phone' }];

        function chooserButton(element) {
            return Array.from(element.shadowRoot.querySelectorAll('lightning-button-icon')).find(
                (button) => button.alternativeText === 'Choose columns'
            );
        }

        function chooserCheckboxes(element) {
            return Array.from(element.shadowRoot.querySelector('c-column-chooser').shadowRoot.querySelectorAll('lightning-input'));
        }

        function tableFieldNames(element) {
            return element.shadowRoot.querySelector('lightning-datatable').columns.map((column) => column.fieldName);
        }

        it('is not offered unless enabled', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({ columns: THREE_COLUMNS });
            await flushPromises();

            expect(chooserButton(element)).toBeUndefined();
        });

        it('opens a panel, and unchecking a column hides it without another query', async () => {
            queryRecords.mockResolvedValue(queryResult([{ Id: '1', Name: 'Acme', Industry: 'Tech', Phone: '555' }]));
            const element = createDatatable({ columns: THREE_COLUMNS, enableColumnChooser: true });
            await flushPromises();
            expect(element.shadowRoot.querySelector('c-column-chooser')).toBeNull();

            chooserButton(element).click();
            await flushPromises();
            const industry = chooserCheckboxes(element)[1];
            industry.checked = false;
            industry.dispatchEvent(new CustomEvent('change'));
            await flushPromises();

            expect(tableFieldNames(element)).toEqual(['Name', 'Phone']);
            expect(queryRecords).toHaveBeenCalledTimes(1);
            expect(element.currentConfig.columns).toEqual(['Name', 'Phone']);
        });

        it('still queries every column, so a hidden one is ready the moment it is shown again', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({ columns: THREE_COLUMNS, enableColumnChooser: true });
            await flushPromises();

            chooserButton(element).click();
            await flushPromises();
            const phone = chooserCheckboxes(element)[2];
            phone.checked = false;
            phone.dispatchEvent(new CustomEvent('change'));
            await flushPromises();
            element.refresh();
            await flushPromises();

            expect(queryRecords).toHaveBeenLastCalledWith(expect.objectContaining({ fields: expect.arrayContaining(['Phone']) }));
        });

        it('returns to "all columns" once everything is checked again', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({ columns: THREE_COLUMNS, enableColumnChooser: true });
            await flushPromises();
            chooserButton(element).click();
            await flushPromises();

            const industry = chooserCheckboxes(element)[1];
            industry.checked = false;
            industry.dispatchEvent(new CustomEvent('change'));
            await flushPromises();
            const again = chooserCheckboxes(element)[1];
            again.checked = true;
            again.dispatchEvent(new CustomEvent('change'));
            await flushPromises();

            expect(tableFieldNames(element)).toEqual(['Name', 'Industry', 'Phone']);
            expect(element.currentConfig.columns).toBeNull();
        });

        it('never hides row-action columns, which have no field name', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const actionColumn = { type: 'action', typeAttributes: { rowActions: [] } };
            const element = createDatatable({ columns: [...THREE_COLUMNS, actionColumn], enableColumnChooser: true });
            await flushPromises();
            chooserButton(element).click();
            await flushPromises();

            const phone = chooserCheckboxes(element)[2];
            phone.checked = false;
            phone.dispatchEvent(new CustomEvent('change'));
            await flushPromises();

            expect(element.shadowRoot.querySelector('lightning-datatable').columns).toHaveLength(3);
            expect(element.shadowRoot.querySelector('lightning-datatable').columns[2].type).toBe('action');
        });
    });

    describe('currentConfig and applyConfig', () => {
        const THREE_COLUMNS = [
            { label: 'Name', fieldName: 'Name', type: 'text', filterable: true },
            { label: 'Industry', fieldName: 'Industry', type: 'text', filterable: true },
            { label: 'Phone', fieldName: 'Phone', type: 'phone' }
        ];

        it('describes the default layout', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({ columns: THREE_COLUMNS, defaultSortField: 'Name', defaultSortDirection: 'asc' });
            await flushPromises();

            expect(element.currentConfig).toEqual({
                v: 1,
                columns: null,
                sortedBy: 'Name',
                sortedDirection: 'asc',
                searchTerm: '',
                columnFilters: {}
            });
        });

        it('picks up typed search text and column filters, leaving out empty filters', async () => {
            jest.useFakeTimers();
            try {
                queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
                const element = createDatatable({ columns: THREE_COLUMNS, searchFields: ['Name'] });
                await Promise.resolve();

                const search = Array.from(element.shadowRoot.querySelectorAll('lightning-input')).find((input) => input.type === 'search');
                search.value = 'acme';
                search.dispatchEvent(new CustomEvent('change'));
                const filter = Array.from(element.shadowRoot.querySelectorAll('lightning-input')).find((input) => input.label === 'Industry');
                filter.value = 'Tech';
                filter.dispatchEvent(new CustomEvent('change'));
                const cleared = Array.from(element.shadowRoot.querySelectorAll('lightning-input')).find((input) => input.label === 'Name');
                cleared.value = '';
                cleared.dispatchEvent(new CustomEvent('change'));

                expect(element.currentConfig.searchTerm).toBe('acme');
                expect(element.currentConfig.columnFilters).toEqual({ Industry: 'Tech' });
            } finally {
                jest.useRealTimers();
            }
        });

        it('applies columns, sort, search and filters, then queries page 1 with them', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({ columns: THREE_COLUMNS, searchFields: ['Name'] });
            await flushPromises();
            queryRecords.mockClear();

            element.applyConfig({
                v: 1,
                columns: ['Name', 'Phone'],
                sortedBy: 'Industry',
                sortedDirection: 'desc',
                searchTerm: 'acme',
                columnFilters: { Industry: 'Tech' }
            });
            await flushPromises();

            expect(queryRecords).toHaveBeenCalledTimes(1);
            expect(queryRecords).toHaveBeenCalledWith(
                expect.objectContaining({
                    pageNumber: 1,
                    sortField: 'Industry',
                    sortDirection: 'desc',
                    searchTerm: 'acme',
                    filters: [{ fieldName: 'Industry', operatorName: '=', value: 'Tech' }]
                })
            );
            expect(element.shadowRoot.querySelector('lightning-datatable').columns.map((c) => c.fieldName)).toEqual(['Name', 'Phone']);
        });

        it('shows the applied search text and filter values in their inputs', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({ columns: THREE_COLUMNS, searchFields: ['Name'] });
            await flushPromises();

            element.applyConfig({ searchTerm: 'acme', columnFilters: { Industry: 'Tech' } });
            await flushPromises();

            const inputs = Array.from(element.shadowRoot.querySelectorAll('lightning-input'));
            expect(inputs.find((input) => input.type === 'search').value).toBe('acme');
            expect(inputs.find((input) => input.label === 'Industry').value).toBe('Tech');
            expect(inputs.find((input) => input.label === 'Name').value).toBe('');
        });

        it('ignores columns, sort fields and filters this table does not have', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({ columns: THREE_COLUMNS, defaultSortField: 'Name', defaultSortDirection: 'asc' });
            await flushPromises();

            element.applyConfig({
                columns: ['Gone__c'],
                sortedBy: 'Gone__c',
                sortedDirection: 'desc',
                columnFilters: { Phone: 'not filterable', Gone__c: 'x' }
            });
            await flushPromises();

            expect(element.currentConfig).toEqual({
                v: 1,
                columns: null,
                sortedBy: 'Name',
                sortedDirection: 'asc',
                searchTerm: '',
                columnFilters: {}
            });
        });

        it('treats a null config as "reset to the defaults"', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({ columns: THREE_COLUMNS, defaultSortField: 'Name', defaultSortDirection: 'asc' });
            await flushPromises();
            element.applyConfig({ columns: ['Name'], sortedBy: 'Industry', sortedDirection: 'desc', searchTerm: 'x' });
            await flushPromises();

            element.applyConfig(null);
            await flushPromises();

            expect(element.currentConfig).toEqual({
                v: 1,
                columns: null,
                sortedBy: 'Name',
                sortedDirection: 'asc',
                searchTerm: '',
                columnFilters: {}
            });
        });

        it('uses a config whose columns are not fewer than the table\'s as "all columns"', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({ columns: THREE_COLUMNS });
            await flushPromises();

            element.applyConfig({ columns: ['Name', 'Industry', 'Phone'] });
            await flushPromises();

            expect(element.currentConfig.columns).toBeNull();
        });
    });

    describe('saved views', () => {
        function savedView(id, name, config, isDefault = false) {
            return { id, name, config: JSON.stringify(config), isDefault };
        }

        it('has no view bar without a view-key, and queries straight away', async () => {
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable();
            await flushPromises();

            expect(element.shadowRoot.querySelector('c-datatable-view-bar')).toBeNull();
            expect(queryRecords).toHaveBeenCalledTimes(1);
            expect(getViews).not.toHaveBeenCalled();
        });

        it('waits for the user\'s views, then queries once with the default view applied', async () => {
            let resolveViews;
            getViews.mockReturnValue(
                new Promise((resolve) => {
                    resolveViews = resolve;
                })
            );
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({ viewKey: 'accounts-main', searchFields: ['Name'] });
            await flushPromises();

            expect(getViews).toHaveBeenCalledWith({ viewKey: 'accounts-main' });
            expect(queryRecords).not.toHaveBeenCalled();

            resolveViews([savedView('v1', 'Acme only', { v: 1, searchTerm: 'acme', sortedBy: 'Industry', sortedDirection: 'desc' }, true)]);
            await flushPromises();

            expect(queryRecords).toHaveBeenCalledTimes(1);
            expect(queryRecords).toHaveBeenCalledWith(
                expect.objectContaining({ searchTerm: 'acme', sortField: 'Industry', sortDirection: 'desc', pageNumber: 1 })
            );
            expect(element.currentConfig.searchTerm).toBe('acme');
        });

        it('queries once with the defaults when no view is the default', async () => {
            getViews.mockResolvedValue([savedView('v1', 'Acme only', { v: 1, searchTerm: 'acme' })]);
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            createDatatable({ viewKey: 'accounts-main', searchFields: ['Name'] });
            await flushPromises();

            expect(queryRecords).toHaveBeenCalledTimes(1);
            expect(queryRecords).toHaveBeenCalledWith(expect.objectContaining({ searchTerm: '' }));
        });

        it('still loads the table when the views cannot be read', async () => {
            getViews.mockRejectedValue({ body: { message: 'No access' } });
            queryRecords.mockResolvedValue(queryResult([{ Id: '1', Name: 'Acme' }]));
            const element = createDatatable({ viewKey: 'accounts-main' });
            await flushPromises();

            expect(queryRecords).toHaveBeenCalledTimes(1);
            expect(element.shadowRoot.querySelector('lightning-datatable').data).toHaveLength(1);
        });

        it('shows a spinner rather than "no records" while it waits for the views', async () => {
            getViews.mockReturnValue(new Promise(() => {}));
            const element = createDatatable({ viewKey: 'accounts-main' });
            await flushPromises();

            const stateManager = element.shadowRoot.querySelector('c-state-manager');
            expect(stateManager.isLoading).toBe(true);
            expect(stateManager.isEmpty).toBe(false);
        });

        it('re-queries from page 1 with a view the user picks, and resets for "All records"', async () => {
            getViews.mockResolvedValue([savedView('v1', 'Tech', { v: 1, searchTerm: 'tech' })]);
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({ viewKey: 'accounts-main', searchFields: ['Name'] });
            await flushPromises();
            queryRecords.mockClear();

            const bar = element.shadowRoot.querySelector('c-datatable-view-bar');
            bar.dispatchEvent(new CustomEvent('viewselect', { detail: { viewId: 'v1', config: { v: 1, searchTerm: 'tech' } } }));
            await flushPromises();
            expect(queryRecords).toHaveBeenLastCalledWith(expect.objectContaining({ searchTerm: 'tech', pageNumber: 1 }));

            bar.dispatchEvent(new CustomEvent('viewselect', { detail: { viewId: null, config: null } }));
            await flushPromises();
            expect(queryRecords).toHaveBeenLastCalledWith(expect.objectContaining({ searchTerm: '', pageNumber: 1 }));
        });

        it('hands the view bar the table\'s current settings', async () => {
            getViews.mockResolvedValue([]);
            queryRecords.mockResolvedValue(queryResult([SAMPLE_ROW]));
            const element = createDatatable({ viewKey: 'accounts-main', defaultSortField: 'Name', defaultSortDirection: 'asc' });
            await flushPromises();

            const bar = element.shadowRoot.querySelector('c-datatable-view-bar');
            expect(bar.viewKey).toBe('accounts-main');
            expect(bar.objectApiName).toBe('Account');
            expect(bar.currentConfig).toEqual(element.currentConfig);
        });
    });
});
