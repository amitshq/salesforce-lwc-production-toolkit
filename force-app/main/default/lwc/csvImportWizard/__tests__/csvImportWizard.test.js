import { createElement } from 'lwc';
import CsvImportWizard from 'c/csvImportWizard';
import saveRecords from '@salesforce/apex/GenericDmlService.saveRecords';
import validateRecords from '@salesforce/apex/GenericDmlService.validateRecords';
import { exportRowsToCsv } from 'c/csvUtils';

jest.mock('@salesforce/apex/GenericDmlService.saveRecords', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/GenericDmlService.validateRecords', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('c/csvUtils', () => ({
    ...jest.requireActual('c/csvUtils'),
    exportRowsToCsv: jest.fn()
}));

const FIELDS = [
    { apiName: 'Name', label: 'Account Name', type: 'text', required: true },
    { apiName: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency' }
];

const CSV = 'Account Name,Annual Revenue\nAcme,1000\nGlobex,oops\nInitech,5';

function wait(ms = 5) {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, description) {
    for (let attempt = 0; attempt < 200; attempt++) {
        if (predicate()) {
            return;
        }
        // eslint-disable-next-line no-await-in-loop
        await wait();
    }
    throw new Error(`Timed out waiting for ${description}`);
}

function createWizard(props = {}) {
    const element = createElement('c-csv-import-wizard', { is: CsvImportWizard });
    element.objectApiName = 'Account';
    element.fields = FIELDS;
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

function button(element, label) {
    return Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((b) => b.label === label);
}

function text(element) {
    return element.shadowRoot.textContent;
}

async function upload(element, csv, name = 'accounts.csv') {
    const input = element.shadowRoot.querySelector('lightning-input');
    input.files = [new File([csv], name)];
    input.dispatchEvent(new CustomEvent('change'));
    await waitFor(
        () => element.shadowRoot.querySelector('lightning-combobox') || element.shadowRoot.querySelector('[role="alert"]'),
        'the file to be processed'
    );
}

describe('c-csv-import-wizard', () => {
    afterEach(() => {
        jest.clearAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    describe('upload', () => {
        it('rejects a file with a header row but no data rows', async () => {
            const element = createWizard();
            await upload(element, 'Account Name,Annual Revenue\n');

            expect(text(element)).toContain('no data rows');
            expect(element.shadowRoot.querySelector('lightning-combobox')).toBeNull();
        });

        it('rejects a file with more rows than maxRows', async () => {
            const element = createWizard({ maxRows: 2 });
            await upload(element, 'Account Name\nA\nB\nC');

            expect(text(element)).toContain('limit is 2');
        });

        it('rejects a file over the size limit', async () => {
            const element = createWizard();
            const input = element.shadowRoot.querySelector('lightning-input');
            input.files = [new File(['x'.repeat(5 * 1024 * 1024 + 1)], 'big.csv')];
            input.dispatchEvent(new CustomEvent('change'));
            await waitFor(() => text(element).includes('limit is 5 MB'), 'the size error');

            expect(element.shadowRoot.querySelector('lightning-combobox')).toBeNull();
        });

        it('reports a file with an unclosed quote', async () => {
            const element = createWizard();
            await upload(element, 'Account Name\n"Acme');

            expect(text(element)).toContain('never closed');
        });
    });

    describe('mapping', () => {
        it('auto-maps columns whose headers match field labels', async () => {
            const element = createWizard();
            await upload(element, CSV);

            const values = Array.from(element.shadowRoot.querySelectorAll('lightning-combobox')).map((c) => c.value);
            expect(values).toEqual(['Name', 'AnnualRevenue']);
            expect(text(element)).toContain('accounts.csv: 3 data rows, 2 columns');
        });

        it('blocks Next while a required field is unmapped', async () => {
            const element = createWizard();
            await upload(element, CSV);

            const [nameCombobox] = element.shadowRoot.querySelectorAll('lightning-combobox');
            nameCombobox.dispatchEvent(new CustomEvent('change', { detail: { value: '' } }));
            button(element, 'Next').click();
            await wait();

            expect(text(element)).toContain('Required field "Account Name" is not mapped to a column.');
            expect(button(element, 'Import 2 rows')).toBeUndefined();
        });
    });

    describe('review', () => {
        async function toReview(element) {
            await upload(element, CSV);
            button(element, 'Next').click();
            await waitFor(() => button(element, 'Import 2 rows'), 'the review step');
        }

        it('summarizes what will happen and lists problems by row', async () => {
            const element = createWizard();
            await toReview(element);

            expect(text(element)).toContain('2 to create');
            expect(text(element)).toContain('1 with problems (will be skipped)');
            expect(text(element)).toContain('Row 3 (Annual Revenue): "oops" is not a valid number.');
        });

        it('previews the rows that will be imported with typed values', async () => {
            const element = createWizard();
            await toReview(element);

            const cells = Array.from(element.shadowRoot.querySelectorAll('tbody tr')).map((row) =>
                Array.from(row.querySelectorAll('td')).map((td) => td.textContent)
            );
            expect(cells).toEqual([
                ['2', 'Acme', '1000'],
                ['4', 'Initech', '5']
            ]);
        });

        it('downloads a problem report', async () => {
            const element = createWizard();
            await toReview(element);

            button(element, 'Download problem report').click();

            expect(exportRowsToCsv).toHaveBeenCalledWith(
                [{ Row: 3, Field: 'Annual Revenue', Message: '"oops" is not a valid number.' }],
                ['Row', 'Field', 'Message'],
                'import-errors.csv'
            );
        });
    });

    describe('import', () => {
        async function startImport(element, csv = CSV) {
            await upload(element, csv);
            button(element, 'Next').click();
            await waitFor(() => Array.from(element.shadowRoot.querySelectorAll('lightning-button')).some((b) => b.label.startsWith('Import ')), 'the review step');
            Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((b) => b.label.startsWith('Import ')).click();
        }

        it('sends the valid rows keyed by row number, then reports the outcome and fires importcomplete', async () => {
            saveRecords.mockResolvedValue([
                { rowKey: '2', success: true },
                { rowKey: '4', success: true }
            ]);
            const element = createWizard();
            const completeHandler = jest.fn();
            element.addEventListener('importcomplete', completeHandler);

            await startImport(element);
            await waitFor(() => completeHandler.mock.calls.length, 'the import to finish');

            expect(saveRecords).toHaveBeenCalledTimes(1);
            expect(saveRecords).toHaveBeenCalledWith({
                objectApiName: 'Account',
                records: [
                    { rowKey: '2', fields: { Name: 'Acme', AnnualRevenue: 1000 } },
                    { rowKey: '4', fields: { Name: 'Initech', AnnualRevenue: 5 } }
                ]
            });
            expect(completeHandler.mock.calls[0][0].detail).toEqual({
                successCount: 2,
                failureCount: 0,
                validationFailureCount: 1,
                notAttemptedCount: 0,
                emptyRowCount: 0
            });
            await wait();
            expect(text(element)).toContain('2 rows imported.');
            expect(text(element)).toContain('1 row skipped because of problems found before import.');
        });

        it('splits the import into chunks of chunkSize', async () => {
            saveRecords.mockImplementation(({ records }) => Promise.resolve(records.map((r) => ({ rowKey: r.rowKey, success: true }))));
            const element = createWizard({ chunkSize: 1 });
            const completeHandler = jest.fn();
            element.addEventListener('importcomplete', completeHandler);

            await startImport(element);
            await waitFor(() => completeHandler.mock.calls.length, 'the import to finish');

            expect(saveRecords).toHaveBeenCalledTimes(2);
            expect(saveRecords.mock.calls.map((call) => call[0].records.map((r) => r.rowKey))).toEqual([['2'], ['4']]);
        });

        it('reports rows the server rejected and offers an error report that includes them', async () => {
            saveRecords.mockResolvedValue([
                { rowKey: '2', success: true },
                { rowKey: '4', success: false, message: 'Duplicate value found.', fieldNames: ['Name'] }
            ]);
            const element = createWizard();
            const completeHandler = jest.fn();
            element.addEventListener('importcomplete', completeHandler);

            await startImport(element);
            await waitFor(() => completeHandler.mock.calls.length, 'the import to finish');
            await wait();

            expect(completeHandler.mock.calls[0][0].detail.failureCount).toBe(1);
            expect(text(element)).toContain('1 row failed on the server.');

            button(element, 'Download error report').click();
            expect(exportRowsToCsv).toHaveBeenCalledWith(
                [
                    { Row: 3, Field: 'Annual Revenue', Message: '"oops" is not a valid number.' },
                    { Row: 4, Field: 'Name', Message: 'Duplicate value found.' }
                ],
                ['Row', 'Field', 'Message'],
                'import-errors.csv'
            );
        });

        it('marks every row in a chunk as failed when the Apex call itself throws', async () => {
            saveRecords.mockRejectedValue({ body: { message: 'Unable to save records: limit exceeded' } });
            const element = createWizard();
            const completeHandler = jest.fn();
            element.addEventListener('importcomplete', completeHandler);

            await startImport(element);
            await waitFor(() => completeHandler.mock.calls.length, 'the import to finish');

            expect(completeHandler.mock.calls[0][0].detail).toMatchObject({ successCount: 0, failureCount: 2 });
        });

        it('stops after the chunk in flight when Cancel is clicked', async () => {
            const element = createWizard({ chunkSize: 1 });
            saveRecords.mockImplementation(async ({ records }) => {
                await Promise.resolve();
                button(element, 'Cancel').click();
                return records.map((r) => ({ rowKey: r.rowKey, success: true }));
            });
            const completeHandler = jest.fn();
            element.addEventListener('importcomplete', completeHandler);

            await startImport(element);
            await waitFor(() => completeHandler.mock.calls.length, 'the import to finish');

            expect(saveRecords).toHaveBeenCalledTimes(1);
            expect(completeHandler.mock.calls[0][0].detail).toMatchObject({ successCount: 1, notAttemptedCount: 1 });
        });

        it('"Import another file" returns to the upload step', async () => {
            saveRecords.mockResolvedValue([
                { rowKey: '2', success: true },
                { rowKey: '4', success: true }
            ]);
            const element = createWizard();
            const completeHandler = jest.fn();
            element.addEventListener('importcomplete', completeHandler);
            await startImport(element);
            await waitFor(() => completeHandler.mock.calls.length, 'the import to finish');
            await wait();

            button(element, 'Import another file').click();
            await wait();

            // `type` is a property of lightning-input, not a reflected attribute, so no CSS attribute selector here.
            const fileInput = element.shadowRoot.querySelector('lightning-input');
            expect(fileInput).not.toBeNull();
            expect(fileInput.type).toBe('file');
        });
    });

    describe('checking against Salesforce before importing', () => {
        const FOUR_ROWS = 'Account Name,Annual Revenue\nAcme,1000\nGlobex,oops\nInitech,5\nHooli,7';

        async function toReview(element, csv = FOUR_ROWS) {
            await upload(element, csv);
            button(element, 'Next').click();
            await waitFor(() => Array.from(element.shadowRoot.querySelectorAll('lightning-button')).some((b) => b.label.startsWith('Import ')), 'the review step');
        }

        function passAllBut(rowKeys, message = 'Duplicate account') {
            validateRecords.mockImplementation(({ records }) =>
                Promise.resolve(
                    records.map((record) => {
                        if (rowKeys.includes(record.rowKey)) {
                            return { rowKey: record.rowKey, success: false, message, fieldNames: ['Name'] };
                        }
                        return { rowKey: record.rowKey, success: true };
                    })
                )
            );
        }

        it('is not offered unless switched on', async () => {
            const element = createWizard();
            await toReview(element);

            expect(button(element, 'Check against Salesforce')).toBeUndefined();
        });

        it('checks the rows chunk by chunk and skips the ones Salesforce would reject', async () => {
            passAllBut(['4']);
            const element = createWizard({ enableServerCheck: true, chunkSize: 2 });
            await toReview(element);

            button(element, 'Check against Salesforce').click();
            await waitFor(() => button(element, 'Import 2 rows'), 'the check to finish');

            expect(validateRecords.mock.calls.map((call) => call[0].records.map((record) => record.rowKey))).toEqual([['2', '4'], ['5']]);
            expect(validateRecords.mock.calls[0][0]).toEqual({
                objectApiName: 'Account',
                records: [
                    { rowKey: '2', fields: { Name: 'Acme', AnnualRevenue: 1000 } },
                    { rowKey: '4', fields: { Name: 'Initech', AnnualRevenue: 5 } }
                ]
            });
            expect(text(element)).toContain('Checked 3 rows against Salesforce: 2 would import, 1 would fail and will be skipped');
            expect(text(element)).toContain('Row 3 (Annual Revenue): "oops" is not a valid number.');
            expect(text(element)).toContain('Row 4 (Name): Duplicate account');
            expect(text(element)).toContain('2 with problems (will be skipped)');
            expect(button(element, 'Check against Salesforce')).toBeUndefined();
        });

        it('imports only the rows that passed', async () => {
            passAllBut(['4']);
            saveRecords.mockImplementation(({ records }) => Promise.resolve(records.map((record) => ({ rowKey: record.rowKey, success: true }))));
            const element = createWizard({ enableServerCheck: true });
            await toReview(element);
            button(element, 'Check against Salesforce').click();
            await waitFor(() => button(element, 'Import 2 rows'), 'the check to finish');

            button(element, 'Import 2 rows').click();
            await waitFor(() => text(element).includes('rows imported'), 'the import to finish');

            expect(saveRecords.mock.calls[0][0].records.map((record) => record.rowKey)).toEqual(['2', '5']);
            expect(text(element)).toContain('2 rows skipped because of problems found before import.');
        });

        it('says when every row would import', async () => {
            passAllBut([]);
            const element = createWizard({ enableServerCheck: true });
            await toReview(element);

            button(element, 'Check against Salesforce').click();
            await waitFor(() => text(element).includes('all would import'), 'the check to finish');

            expect(text(element)).toContain('Checked 3 rows against Salesforce: all would import.');
            expect(button(element, 'Import 3 rows')).not.toBeUndefined();
        });

        it('keeps what it learned when a chunk cannot be checked, and offers to try again', async () => {
            validateRecords
                .mockImplementationOnce(({ records }) =>
                    Promise.resolve([{ rowKey: records[0].rowKey, success: false, message: 'Required field missing' }, { rowKey: records[1].rowKey, success: true }])
                )
                .mockRejectedValueOnce({ body: { message: 'Apex CPU time limit exceeded' } });
            const element = createWizard({ enableServerCheck: true, chunkSize: 2 });
            await toReview(element);

            button(element, 'Check against Salesforce').click();
            await waitFor(() => button(element, 'Check again'), 'the check to stop');

            expect(text(element)).toContain('The check stopped after 2 of 3 rows: Apex CPU time limit exceeded');
            expect(button(element, 'Import 2 rows')).not.toBeUndefined();
        });

        it('starts over when the mapping is changed', async () => {
            passAllBut(['4']);
            const element = createWizard({ enableServerCheck: true });
            await toReview(element);
            button(element, 'Check against Salesforce').click();
            await waitFor(() => button(element, 'Import 2 rows'), 'the check to finish');

            button(element, 'Back').click();
            await waitFor(() => button(element, 'Next'), 'the mapping step');
            button(element, 'Next').click();
            await waitFor(() => button(element, 'Import 3 rows'), 'the review step');

            expect(button(element, 'Check against Salesforce')).not.toBeUndefined();
            expect(text(element)).not.toContain('Checked 3 rows');
        });
    });
});
