import { createElement } from 'lwc';
import EnterpriseDatatable from 'c/enterpriseDatatable';
import queryRecords from '@salesforce/apex/GenericQueryService.query';
import queryBatch from '@salesforce/apex/GenericQueryService.queryBatch';
import queryPage from '@salesforce/apex/CursorPagingService.queryPage';
import saveRecords from '@salesforce/apex/GenericDmlService.saveRecords';
import deleteRecords from '@salesforce/apex/GenericDmlService.deleteRecords';
import undeleteRecords from '@salesforce/apex/GenericDmlService.undeleteRecords';
import summarize from '@salesforce/apex/GenericAggregateService.summarize';
import { getObjectInfo, getPicklistValuesByRecordType } from 'lightning/uiObjectInfoApi';
import { getObjectAccess } from 'c/permissionUtils';
import { navigateToRecord } from 'c/navigationUtils';
import { downloadCsv } from 'c/csvUtils';
import ConfirmDialog from 'c/confirmDialog';
import MassUpdateDialog from 'c/massUpdateDialog';

jest.mock('@salesforce/apex/GenericQueryService.query', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/GenericQueryService.queryBatch', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/CursorPagingService.queryPage', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/GenericDmlService.saveRecords', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/GenericDmlService.deleteRecords', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/GenericDmlService.undeleteRecords', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/GenericAggregateService.summarize', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('c/empUtils', () => ({ subscribeToObjectChanges: jest.fn() }));
jest.mock('c/permissionUtils', () => ({ getObjectAccess: jest.fn() }));
jest.mock('c/recordUtils', () => ({ notifyRecordsChanged: jest.fn(() => Promise.resolve()) }));
jest.mock('c/navigationUtils', () => ({ navigateToRecord: jest.fn() }));
jest.mock('c/csvUtils', () => {
    const actual = jest.requireActual('c/csvUtils');
    return { ...actual, downloadCsv: jest.fn() };
});
jest.mock('c/confirmDialog', () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock('c/massUpdateDialog', () => ({ __esModule: true, default: { open: jest.fn() } }));

const COLUMNS = [
    { label: 'Name', fieldName: 'Name', type: 'text', editable: true },
    { label: 'Industry', fieldName: 'Industry', type: 'text', editable: true },
    { label: 'Revenue', fieldName: 'AnnualRevenue', type: 'currency', editable: true },
    { label: 'Owner', fieldName: 'Owner.Name', type: 'text' }
];

const ROWS = [
    { Id: '001A', Name: 'Acme', Industry: 'Tech', AnnualRevenue: 100, Owner: { Id: '005A', Name: 'Ann' } },
    { Id: '001B', Name: 'Bolt', Industry: 'Banking', AnnualRevenue: 300, Owner: { Id: '005B', Name: 'Bea' } }
];

function queryResult(records, overrides = {}) {
    return { records, totalCount: records.length, pageNumber: 1, pageSize: 25, hasMore: false, ...overrides };
}

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function settle() {
    for (let i = 0; i < 4; i++) {
        // eslint-disable-next-line no-await-in-loop
        await flushPromises();
    }
}

async function createDatatable(props = {}) {
    const element = createElement('c-enterprise-datatable', { is: EnterpriseDatatable });
    element.objectApiName = 'Account';
    element.columns = COLUMNS;
    Object.assign(element, props);
    document.body.appendChild(element);
    await settle();
    return element;
}

function table(element) {
    return element.shadowRoot.querySelector('.records-table');
}

function bulkActionNames(element) {
    return element.shadowRoot.querySelector('c-bulk-action-bar').actions.map((action) => action.name);
}

async function select(element, rows) {
    table(element).dispatchEvent(new CustomEvent('rowselection', { detail: { selectedRows: rows } }));
    await settle();
}

async function runBulkAction(element, name) {
    element.shadowRoot.querySelector('c-bulk-action-bar').dispatchEvent(new CustomEvent('action', { detail: { name } }));
    await settle();
}

async function runRowAction(element, name, row) {
    table(element).dispatchEvent(new CustomEvent('rowaction', { detail: { action: { name }, row } }));
    await settle();
}

describe('c-enterprise-datatable features', () => {
    beforeEach(() => {
        queryRecords.mockResolvedValue(queryResult(ROWS));
        getObjectAccess.mockResolvedValue({ isAccessible: true, isUpdateable: true, isDeletable: true });
        ConfirmDialog.open.mockResolvedValue(true);
        summarize.mockResolvedValue([{ groups: {}, values: { t0: 400 } }]);
    });

    afterEach(() => {
        jest.resetAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    describe('row actions and record links', () => {
        it('adds a row menu with the built-in actions once the user is known to have access', async () => {
            const element = await createDatatable({ rowActions: 'view, edit,delete' });

            const actionColumn = table(element).columns.find((column) => column.type === 'action');
            expect(actionColumn.typeAttributes.rowActions.map((action) => action.label)).toEqual(['View', 'Edit', 'Delete']);
        });

        it('leaves Edit and Delete out for a user who cannot edit or delete the object', async () => {
            getObjectAccess.mockResolvedValue({ isUpdateable: false, isDeletable: false });
            const element = await createDatatable({ rowActions: ['view', 'edit', 'delete', { name: 'call', label: 'Log a call' }] });

            const actionColumn = table(element).columns.find((column) => column.type === 'action');
            expect(actionColumn.typeAttributes.rowActions.map((action) => action.name)).toEqual(['view', 'call']);
        });

        it('has no row menu unless row actions are given', async () => {
            const element = await createDatatable();

            expect(table(element).columns.some((column) => column.type === 'action')).toBe(false);
            expect(getObjectAccess).not.toHaveBeenCalled();
        });

        it('opens the record for View and its edit page for Edit', async () => {
            const element = await createDatatable({ rowActions: 'view,edit' });

            await runRowAction(element, 'view', ROWS[0]);
            await runRowAction(element, 'edit', ROWS[1]);

            expect(navigateToRecord).toHaveBeenNthCalledWith(1, expect.anything(), '001A', 'Account', 'view');
            expect(navigateToRecord).toHaveBeenNthCalledWith(2, expect.anything(), '001B', 'Account', 'edit');
        });

        it('tells the parent about every row action, and a parent can replace a built-in one', async () => {
            const element = await createDatatable({ rowActions: 'view,call' });
            const handler = jest.fn((event) => {
                if (event.detail.name === 'view') {
                    event.preventDefault();
                }
            });
            element.addEventListener('rowaction', handler);

            await runRowAction(element, 'call', ROWS[0]);
            await runRowAction(element, 'view', ROWS[0]);

            expect(handler).toHaveBeenCalledTimes(2);
            expect(handler.mock.calls[0][0].detail).toEqual(expect.objectContaining({ name: 'call', row: ROWS[0] }));
            expect(navigateToRecord).not.toHaveBeenCalled();
        });

        it('deletes one row from its menu after asking, and offers to undo it', async () => {
            deleteRecords.mockResolvedValue([{ rowKey: '001A', success: true }]);
            const element = await createDatatable({ rowActions: 'delete' });
            const onDelete = jest.fn();
            element.addEventListener('delete', onDelete);

            await runRowAction(element, 'delete', ROWS[0]);

            expect(ConfirmDialog.open).toHaveBeenCalledWith(expect.objectContaining({ label: 'Delete Record' }));
            expect(deleteRecords).toHaveBeenCalledWith({ objectApiName: 'Account', recordIds: ['001A'] });
            expect(table(element).data.map((row) => row.Id)).toEqual(['001B']);
            expect(element.shadowRoot.querySelector('.undo-bar').textContent).toContain('1 record deleted.');
            expect(onDelete.mock.calls[0][0].detail).toEqual({ recordIds: ['001A'] });
        });

        it('shows a linked column as a link to each record, and keeps it editable', async () => {
            const element = await createDatatable({
                columns: [{ label: 'Name', fieldName: 'Name', editable: true, linkToRecord: true }, ...COLUMNS.slice(1)]
            });

            const datatable = element.shadowRoot.querySelector('c-extended-datatable');
            expect(datatable).not.toBeNull();
            expect(element.shadowRoot.querySelector('lightning-datatable')).toBeNull();
            const nameColumn = datatable.columns[0];
            expect(nameColumn).toEqual(
                expect.objectContaining({ fieldName: 'Name', type: 'recordLink', editable: true, typeAttributes: expect.objectContaining({ url: { fieldName: 'Name__url' } }) })
            );
            expect(datatable.data[0].Name__url).toBe('/lightning/r/001A/view');
        });

        it('links a relationship column to the related record, using a custom URL pattern', async () => {
            const element = await createDatatable({
                recordUrlTemplate: '/s/detail/{recordId}',
                columns: [...COLUMNS.slice(0, 3), { label: 'Owner', fieldName: 'Owner.Name', linkToRecord: true }]
            });

            expect(queryRecords.mock.calls[0][0].fields).toEqual(expect.arrayContaining(['Owner.Name', 'Owner.Id']));
            expect(table(element).data[1].Owner_Name__url).toBe('/s/detail/005B');
            expect(table(element).columns[3].typeAttributes.url).toEqual({ fieldName: 'Owner_Name__url' });
        });

        it('fires load with each page it shows', async () => {
            const element = createElement('c-enterprise-datatable', { is: EnterpriseDatatable });
            const onLoad = jest.fn();
            element.addEventListener('load', onLoad);
            element.objectApiName = 'Account';
            element.columns = COLUMNS;
            document.body.appendChild(element);
            await settle();

            expect(onLoad).toHaveBeenCalledTimes(1);
            expect(onLoad.mock.calls[0][0].detail).toEqual(expect.objectContaining({ totalCount: 2, pageNumber: 1, pageSize: 25 }));
            expect(onLoad.mock.calls[0][0].detail.records.map((row) => row.Id)).toEqual(['001A', '001B']);
        });

        it('fires save with what was saved and what failed', async () => {
            saveRecords.mockResolvedValue([
                { rowKey: '001A', success: true },
                { rowKey: '001B', success: false, message: 'Nope', isConflict: true }
            ]);
            const element = await createDatatable();
            const onSave = jest.fn();
            element.addEventListener('save', onSave);

            table(element).dispatchEvent(
                new CustomEvent('save', { detail: { draftValues: [{ Id: '001A', Name: 'A' }, { Id: '001B', Name: 'B' }] } })
            );
            await settle();

            expect(onSave.mock.calls[0][0].detail).toEqual({
                source: 'inline',
                savedIds: ['001A'],
                failedRows: [{ rowKey: '001B', message: 'Nope', isConflict: true }]
            });
        });

        it('hands lightning-datatable the selected rows as key values, not row objects', async () => {
            const element = await createDatatable({ enableRowSelection: true });

            await select(element, [ROWS[1]]);

            expect(table(element).selectedRows).toEqual(['001B']);
        });
    });

    describe('undo delete', () => {
        async function deleteFirstRow(element) {
            deleteRecords.mockResolvedValue([{ rowKey: '001A', success: true }]);
            await select(element, [ROWS[0]]);
            await runBulkAction(element, '__bulkDelete');
        }

        it('restores the deleted records, reloads, and says so', async () => {
            const element = await createDatatable({ enableBulkDelete: true, enableRowSelection: true });
            const onRestore = jest.fn();
            element.addEventListener('restore', onRestore);
            await deleteFirstRow(element);
            undeleteRecords.mockResolvedValue([{ rowKey: '001A', success: true }]);
            queryRecords.mockClear();

            element.shadowRoot.querySelector('.undo-button').click();
            await settle();

            expect(undeleteRecords).toHaveBeenCalledWith({ objectApiName: 'Account', recordIds: ['001A'] });
            expect(queryRecords).toHaveBeenCalledTimes(1);
            expect(onRestore.mock.calls[0][0].detail).toEqual({ recordIds: ['001A'] });
            expect(element.shadowRoot.querySelector('.undo-bar')).toBeNull();
        });

        it('reports only the records that came back', async () => {
            const element = await createDatatable({ enableBulkDelete: true, enableRowSelection: true });
            const onRestore = jest.fn();
            element.addEventListener('restore', onRestore);
            await deleteFirstRow(element);
            undeleteRecords.mockResolvedValue([
                { rowKey: '001A', success: false, message: 'Emptied from the Recycle Bin' }
            ]);

            element.shadowRoot.querySelector('.undo-button').click();
            await settle();

            expect(onRestore).not.toHaveBeenCalled();
            expect(element.shadowRoot.querySelector('.undo-bar')).toBeNull();
        });

        it('can be dismissed', async () => {
            const element = await createDatatable({ enableBulkDelete: true, enableRowSelection: true });
            await deleteFirstRow(element);

            element.shadowRoot.querySelector('.undo-dismiss').click();
            await settle();

            expect(element.shadowRoot.querySelector('.undo-bar')).toBeNull();
            expect(undeleteRecords).not.toHaveBeenCalled();
        });
    });

    describe('mass update', () => {
        it('offers "Update field" only when switched on, with editable columns and edit access', async () => {
            const off = await createDatatable({ enableRowSelection: true });
            const on = await createDatatable({ enableRowSelection: true, enableMassUpdate: true });

            expect(bulkActionNames(off)).not.toContain('__massUpdate');
            expect(bulkActionNames(on)).toContain('__massUpdate');
        });

        it('is not offered to a user who cannot edit the object', async () => {
            getObjectAccess.mockResolvedValue({ isUpdateable: false, isDeletable: false });
            const element = await createDatatable({ enableRowSelection: true, enableMassUpdate: true });

            expect(bulkActionNames(element)).not.toContain('__massUpdate');
        });

        it('offers the editable fields of the object itself, not relationship columns', async () => {
            MassUpdateDialog.open.mockResolvedValue(undefined);
            const element = await createDatatable({ enableRowSelection: true, enableMassUpdate: true });
            await select(element, ROWS);

            await runBulkAction(element, '__massUpdate');

            const { fields, recordCount } = MassUpdateDialog.open.mock.calls[0][0];
            expect(recordCount).toBe(2);
            expect(fields.map((field) => field.fieldName)).toEqual(['Name', 'Industry', 'AnnualRevenue']);
            expect(saveRecords).not.toHaveBeenCalled();
        });

        it('saves the value on every selected row, 200 rows at a time, with conflict checks', async () => {
            const many = Array.from({ length: 450 }, (_, index) => ({
                Id: `001${String(index).padStart(3, '0')}`,
                Name: `Row ${index}`,
                SystemModstamp: '2026-01-01T00:00:00.000Z'
            }));
            queryRecords.mockResolvedValue(queryResult(many, { totalCount: 450 }));
            saveRecords.mockImplementation(({ records }) => Promise.resolve(records.map((record) => ({ rowKey: record.rowKey, success: true }))));
            MassUpdateDialog.open.mockResolvedValue({ fieldName: 'Industry', value: 'Energy' });
            const element = await createDatatable({ enableRowSelection: true, enableMassUpdate: true, enableConflictDetection: true });
            const onSave = jest.fn();
            element.addEventListener('save', onSave);
            await select(element, many);

            await runBulkAction(element, '__massUpdate');

            expect(saveRecords.mock.calls.map((call) => call[0].records.length)).toEqual([200, 200, 50]);
            expect(saveRecords.mock.calls[0][0].records[0]).toEqual({
                rowKey: '001000',
                fields: { Id: '001000', Industry: 'Energy' },
                expectedModstamp: Date.parse('2026-01-01T00:00:00.000Z')
            });
            expect(table(element).data.every((row) => row.Industry === 'Energy')).toBe(true);
            expect(onSave.mock.calls[0][0].detail.source).toBe('massUpdate');
            expect(element.shadowRoot.querySelector('.save-progress')).toBeNull();
        });

        it('keeps the rows that failed as drafts with their errors, to fix and save again', async () => {
            saveRecords.mockResolvedValue([
                { rowKey: '001A', success: true },
                { rowKey: '001B', success: false, message: 'Validation failed', fieldNames: ['Industry'] }
            ]);
            MassUpdateDialog.open.mockResolvedValue({ fieldName: 'Industry', value: null });
            const element = await createDatatable({ enableRowSelection: true, enableMassUpdate: true });
            await select(element, ROWS);

            await runBulkAction(element, '__massUpdate');

            expect(table(element).draftValues).toEqual([{ Id: '001B', Industry: null }]);
            expect(table(element).errors.rows['001B'].messages).toEqual(['Validation failed']);
            expect(table(element).data[0].Industry).toBeNull();
        });

        it('reports a chunk the server refused as failed rows, and still saves the other chunks', async () => {
            const many = Array.from({ length: 250 }, (_, index) => ({ Id: `001${String(index).padStart(3, '0')}` }));
            queryRecords.mockResolvedValue(queryResult(many, { totalCount: 250 }));
            saveRecords
                .mockRejectedValueOnce({ body: { message: 'Too many SOQL queries' } })
                .mockImplementationOnce(({ records }) => Promise.resolve(records.map((record) => ({ rowKey: record.rowKey, success: true }))));
            MassUpdateDialog.open.mockResolvedValue({ fieldName: 'Name', value: 'X' });
            const element = await createDatatable({ enableRowSelection: true, enableMassUpdate: true });
            await select(element, many);

            await runBulkAction(element, '__massUpdate');

            expect(saveRecords).toHaveBeenCalledTimes(2);
            expect(table(element).draftValues).toHaveLength(200);
            expect(table(element).errors.rows['001000'].messages).toEqual(['Too many SOQL queries']);
        });

        it('will not run over unsaved inline edits', async () => {
            const element = await createDatatable({ enableRowSelection: true, enableMassUpdate: true });
            table(element).dispatchEvent(new CustomEvent('cellchange', { detail: { draftValues: [{ Id: '001A', Name: 'X' }] } }));
            await select(element, ROWS);

            await runBulkAction(element, '__massUpdate');

            expect(MassUpdateDialog.open).not.toHaveBeenCalled();
        });
    });

    describe('export all matching rows', () => {
        function batch(records, nextCursor) {
            return { records, hasMore: !!nextCursor, nextCursor };
        }

        it('has an export button only when switched on', async () => {
            const off = await createDatatable();
            const on = await createDatatable({ enableExport: true });

            expect(off.shadowRoot.querySelector('.export-button')).toBeNull();
            expect(on.shadowRoot.querySelector('.export-button')).not.toBeNull();
        });

        it('reads every matching row in batches and downloads them in the table sort order', async () => {
            // The server walks rows in Id order; the file must come out in the table's sort order.
            queryBatch
                .mockResolvedValueOnce(batch([ROWS[0]], '001A'))
                .mockResolvedValueOnce(batch([ROWS[1], { Id: '001C', Name: 'Cora', Industry: null, AnnualRevenue: 200, Owner: { Name: 'Cy' } }], null));
            const element = await createDatatable({
                enableExport: true,
                searchFields: ['Name'],
                staticFilters: [{ fieldName: 'Industry', operatorName: '!=', value: 'Gov' }],
                defaultSortField: 'AnnualRevenue',
                defaultSortDirection: 'desc'
            });
            const onExport = jest.fn();
            element.addEventListener('export', onExport);

            const outcome = await element.exportAll();

            expect(queryBatch).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    objectApiName: 'Account',
                    filters: [{ fieldName: 'Industry', operatorName: '!=', value: 'Gov' }],
                    searchFields: ['Name'],
                    afterId: null,
                    batchSize: 2000
                })
            );
            expect(queryBatch).toHaveBeenNthCalledWith(2, expect.objectContaining({ afterId: '001A' }));
            const [fileName, csv] = downloadCsv.mock.calls[0];
            expect(fileName).toBe('Account-export.csv');
            expect(csv.split('\r\n')).toEqual(['Name,Industry,Revenue,Owner', 'Bolt,Banking,300,Bea', 'Cora,,200,Cy', 'Acme,Tech,100,Ann']);
            expect(outcome).toEqual({ rowCount: 3, truncated: false });
            expect(onExport.mock.calls[0][0].detail).toEqual({ rowCount: 3, truncated: false });
        });

        it('exports only the columns that are showing', async () => {
            queryBatch.mockResolvedValueOnce(batch(ROWS, null));
            const element = await createDatatable({ enableExport: true });
            element.applyConfig({ columns: ['Name'] });
            await settle();

            await element.exportAll();

            expect(downloadCsv.mock.calls[0][1].split('\r\n')[0]).toBe('Name');
        });

        it('stops at max-export-rows and says the file was cut short', async () => {
            queryBatch.mockResolvedValueOnce(batch([ROWS[0]], '001A'));
            const element = await createDatatable({ enableExport: true, maxExportRows: 1 });

            const outcome = await element.exportAll();

            expect(queryBatch).toHaveBeenCalledTimes(1);
            expect(queryBatch.mock.calls[0][0].batchSize).toBe(1);
            expect(outcome).toEqual({ rowCount: 1, truncated: true });
        });

        it('shows progress, and a cancelled export downloads nothing', async () => {
            let releaseFirstBatch;
            queryBatch.mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        releaseFirstBatch = () => resolve(batch([ROWS[0]], '001A'));
                    })
            );
            const element = await createDatatable({ enableExport: true });

            const exporting = element.exportAll();
            await flushPromises();
            expect(element.shadowRoot.querySelector('.export-progress').textContent).toContain('Exporting 0 of 2 records');
            element.shadowRoot.querySelector('.export-cancel').click();
            releaseFirstBatch();
            const outcome = await exporting;
            await settle();

            expect(outcome).toEqual({ cancelled: true });
            expect(queryBatch).toHaveBeenCalledTimes(1);
            expect(downloadCsv).not.toHaveBeenCalled();
            expect(element.shadowRoot.querySelector('.export-progress')).toBeNull();
        });

        it('exports rich text as plain text', async () => {
            queryBatch.mockResolvedValueOnce(batch([{ Id: '001A', Notes__c: '<p>Call <b>back</b> &amp; confirm</p>' }], null));
            const element = await createDatatable({
                enableExport: true,
                columns: [{ label: 'Notes', fieldName: 'Notes__c', type: 'richText' }]
            });

            await element.exportAll();

            expect(downloadCsv.mock.calls[0][1].split('\r\n')[1]).toBe('Call back & confirm');
        });
    });

    describe('totals row', () => {
        const TOTALS = [{ fieldName: 'AnnualRevenue', functionName: 'SUM' }];

        it('totals every matching row server-side, with the table search and filters', async () => {
            const element = await createDatatable({
                totals: TOTALS,
                searchFields: ['Name'],
                staticFilters: [{ fieldName: 'Industry', operatorName: '=', value: 'Tech' }]
            });

            expect(summarize).toHaveBeenCalledWith({
                request: {
                    objectApiName: 'Account',
                    aggregates: [{ functionName: 'SUM', fieldName: 'AnnualRevenue', alias: 't0' }],
                    groupByFields: [],
                    filters: [{ fieldName: 'Industry', operatorName: '=', value: 'Tech' }],
                    searchTerm: '',
                    searchFields: ['Name']
                }
            });
            const totals = element.shadowRoot.querySelector('.totals');
            expect(totals.textContent).toContain('Totals for all 2 matching records');
            expect(totals.textContent).toContain('Sum of Revenue');
            expect(element.shadowRoot.querySelector('.totals-value').textContent).toBe('$400.00');
        });

        it('does not recalculate when only the page changes, but does after a save', async () => {
            queryRecords.mockResolvedValue(queryResult(ROWS, { totalCount: 60, hasMore: true }));
            const element = await createDatatable({ totals: TOTALS });
            expect(summarize).toHaveBeenCalledTimes(1);

            element.shadowRoot.querySelectorAll('lightning-button')[1].click();
            await settle();
            expect(summarize).toHaveBeenCalledTimes(1);

            saveRecords.mockResolvedValue([{ rowKey: '001A', success: true }]);
            table(element).dispatchEvent(new CustomEvent('save', { detail: { draftValues: [{ Id: '001A', AnnualRevenue: 5 }] } }));
            await settle();
            expect(summarize).toHaveBeenCalledTimes(2);
        });

        it('says when the totals cannot be calculated, and the table still works', async () => {
            summarize.mockRejectedValue({ body: { message: 'SUM needs a numeric field' } });
            const element = await createDatatable({ totals: [{ fieldName: 'Name' }] });

            expect(element.shadowRoot.querySelector('.totals-error').textContent).toContain('SUM needs a numeric field');
            expect(table(element).data).toHaveLength(2);
        });

        it('asks for nothing without totals', async () => {
            await createDatatable();

            expect(summarize).not.toHaveBeenCalled();
        });
    });

    describe('deep paging', () => {
        it('pages with the cursor service and its reach instead of OFFSET', async () => {
            queryPage.mockResolvedValue(queryResult(ROWS, { totalCount: 150000, hasMore: true, maxPageNumber: 4000 }));
            const element = await createDatatable({ deepPaging: true });

            expect(queryRecords).not.toHaveBeenCalled();
            expect(queryPage).toHaveBeenCalledWith(expect.objectContaining({ objectApiName: 'Account', pageNumber: 1, pageSize: 25 }));
            expect(element.shadowRoot.querySelector('.paging-cap').textContent).toContain('Only the first 100,000 of 150,000 records');
        });
    });

    describe('picklist, lookup and rich-text columns', () => {
        it('fills a picklist column from the field values of the default record type', async () => {
            const element = await createDatatable({
                columns: [{ label: 'Industry', fieldName: 'Industry', type: 'picklist', editable: true }]
            });
            getObjectInfo.emit({ defaultRecordTypeId: '012000000000000AAA' });
            getPicklistValuesByRecordType.emit({
                picklistFieldValues: { Industry: { values: [{ label: 'Banking', value: 'Banking', attributes: null }] } }
            });
            await settle();

            const column = element.shadowRoot.querySelector('c-extended-datatable').columns[0];
            expect(column.typeAttributes.options).toEqual([
                { label: '--None--', value: '' },
                { label: 'Banking', value: 'Banking' }
            ]);
            expect(getPicklistValuesByRecordType.getLastConfig()).toEqual({ objectApiName: 'Account', recordTypeId: '012000000000000AAA' });
        });

        it('uses options given in the column, without --None-- for a required field', async () => {
            const options = [{ label: 'Hot', value: 'Hot' }];
            const element = await createDatatable({
                columns: [{ label: 'Rating', fieldName: 'Rating', type: 'picklist', editable: true, required: true, options }]
            });

            expect(element.shadowRoot.querySelector('c-extended-datatable').columns[0].typeAttributes.options).toEqual(options);
            expect(getObjectInfo.getLastConfig()).toEqual({ objectApiName: undefined });
        });

        it('queries and shows a lookup by name, and forgets the old name once a new record is saved', async () => {
            queryRecords.mockResolvedValue(queryResult([{ Id: '001A', ParentId: '001P', Parent: { Name: 'Parent Co' } }]));
            saveRecords.mockResolvedValue([{ rowKey: '001A', success: true }]);
            const element = await createDatatable({
                columns: [
                    {
                        label: 'Parent',
                        fieldName: 'ParentId',
                        type: 'lookup',
                        editable: true,
                        displayField: 'Parent.Name',
                        typeAttributes: { objectApiName: 'Account' }
                    }
                ]
            });
            const datatable = element.shadowRoot.querySelector('c-extended-datatable');

            expect(queryRecords.mock.calls[0][0].fields).toEqual(expect.arrayContaining(['ParentId', 'Parent.Name']));
            expect(datatable.columns[0].typeAttributes).toEqual(
                expect.objectContaining({
                    objectApiName: 'Account',
                    originalValue: { fieldName: 'ParentId' },
                    displayValue: { fieldName: 'Parent_Name' },
                    urlTemplate: '/lightning/r/{recordId}/view'
                })
            );
            expect(datatable.data[0].Parent_Name).toBe('Parent Co');

            datatable.dispatchEvent(new CustomEvent('save', { detail: { draftValues: [{ Id: '001A', ParentId: '001Q' }] } }));
            await settle();

            expect(datatable.data[0].ParentId).toBe('001Q');
            expect(datatable.data[0].Parent_Name).toBeUndefined();
        });

        it('wraps rich text and offers it to mass update', async () => {
            MassUpdateDialog.open.mockResolvedValue(undefined);
            const element = await createDatatable({
                enableRowSelection: true,
                enableMassUpdate: true,
                columns: [{ label: 'Notes', fieldName: 'Notes__c', type: 'richText', editable: true }]
            });
            await select(element, ROWS);
            await runBulkAction(element, '__massUpdate');

            expect(element.shadowRoot.querySelector('c-extended-datatable').columns[0]).toEqual(
                expect.objectContaining({ type: 'richText', wrapText: true })
            );
            expect(MassUpdateDialog.open.mock.calls[0][0].fields[0]).toEqual(expect.objectContaining({ fieldName: 'Notes__c', type: 'richText' }));
        });

        it('keeps plain lightning-datatable when no column needs a custom type', async () => {
            const element = await createDatatable();

            expect(element.shadowRoot.querySelector('lightning-datatable')).not.toBeNull();
            expect(element.shadowRoot.querySelector('c-extended-datatable')).toBeNull();
        });
    });
});
