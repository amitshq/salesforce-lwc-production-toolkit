import { createElement } from 'lwc';
import EnterpriseDatatable from 'c/enterpriseDatatable';
import queryRecords from '@salesforce/apex/GenericQueryService.query';
import saveRecords from '@salesforce/apex/GenericDmlService.saveRecords';
import deleteRecords from '@salesforce/apex/GenericDmlService.deleteRecords';
import { getObjectAccess } from 'c/permissionUtils';
import { notifyRecordsChanged } from 'c/recordUtils';
import ConfirmDialog from 'c/confirmDialog';

jest.mock('@salesforce/apex/GenericQueryService.query', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/GenericDmlService.saveRecords', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/GenericDmlService.deleteRecords', () => ({ default: jest.fn() }), { virtual: true });

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
});
