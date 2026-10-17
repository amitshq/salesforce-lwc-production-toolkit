import { ID_FIELD, autoMapColumns, validateMapping, coerceValue, buildRecords } from 'c/csvImportEngine';

const FIELDS = [
    { apiName: 'Name', label: 'Account Name', type: 'text', required: true },
    { apiName: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency' },
    { apiName: 'Active__c', label: 'Active', type: 'checkbox' },
    { apiName: 'Founded__c', label: 'Founded', type: 'date' },
    { apiName: 'Email__c', label: 'Contact Email', type: 'email' }
];

describe('csvImportEngine', () => {
    describe('autoMapColumns', () => {
        it('matches headers to API names or labels, ignoring case, spaces and punctuation', () => {
            expect(autoMapColumns(['account name', 'ANNUALREVENUE', 'Contact_Email', 'Unknown'], FIELDS)).toEqual([
                'Name',
                'AnnualRevenue',
                'Email__c',
                ''
            ]);
        });

        it('maps an Id header to the record Id', () => {
            expect(autoMapColumns(['Id', 'Name'], FIELDS)).toEqual([ID_FIELD, 'Name']);
        });

        it('uses each field once, leaving a repeated header unmapped', () => {
            expect(autoMapColumns(['Name', 'Name'], FIELDS)).toEqual(['Name', '']);
        });

        it('leaves blank headers unmapped', () => {
            expect(autoMapColumns(['', '  '], FIELDS)).toEqual(['', '']);
        });
    });

    describe('validateMapping', () => {
        it('requires at least one mapped column', () => {
            expect(validateMapping(['', ''], FIELDS)).toEqual(['Map at least one column to a field.']);
        });

        it('flags a field mapped to two columns', () => {
            expect(validateMapping(['Name', 'Name'], FIELDS)).toEqual(['"Account Name" is mapped to more than one column.']);
        });

        it('flags an unmapped required field', () => {
            expect(validateMapping(['AnnualRevenue'], FIELDS)).toEqual(['Required field "Account Name" is not mapped to a column.']);
        });

        it('does not require the required fields when updating by Id', () => {
            expect(validateMapping([ID_FIELD, 'AnnualRevenue'], FIELDS)).toEqual([]);
        });

        it('accepts a complete mapping', () => {
            expect(validateMapping(['Name', 'AnnualRevenue'], FIELDS)).toEqual([]);
        });
    });

    describe('coerceValue', () => {
        it('skips empty cells', () => {
            expect(coerceValue('', 'number')).toEqual({ skip: true });
            expect(coerceValue('   ', 'text')).toEqual({ skip: true });
        });

        it('converts numbers, including thousands separators', () => {
            expect(coerceValue('42', 'number')).toEqual({ value: 42 });
            expect(coerceValue('-3.5', 'currency')).toEqual({ value: -3.5 });
            expect(coerceValue('1,234,567.80', 'currency')).toEqual({ value: 1234567.8 });
        });

        it('rejects text and ambiguous separators as numbers', () => {
            expect(coerceValue('abc', 'number').error).toContain('not a valid number');
            expect(coerceValue('1.234,50', 'number').error).toContain('not a valid number');
            expect(coerceValue('12,34', 'number').error).toContain('not a valid number');
        });

        it.each([
            ['true', true],
            ['YES', true],
            ['1', true],
            ['false', false],
            ['No', false],
            ['0', false]
        ])('reads %s as a boolean', (text, expected) => {
            expect(coerceValue(text, 'checkbox')).toEqual({ value: expected });
        });

        it('rejects other boolean text', () => {
            expect(coerceValue('maybe', 'checkbox').error).toContain('not a valid true/false');
        });

        it('accepts real ISO dates and rejects impossible or differently formatted ones', () => {
            expect(coerceValue('2024-02-29', 'date')).toEqual({ value: '2024-02-29' });
            expect(coerceValue('2023-02-29', 'date').error).toContain('YYYY-MM-DD');
            expect(coerceValue('2024-13-01', 'date').error).toContain('YYYY-MM-DD');
            expect(coerceValue('3/4/2024', 'date').error).toContain('YYYY-MM-DD');
        });

        it('normalizes datetimes to an ISO string', () => {
            expect(coerceValue('2024-06-15T12:30:00Z', 'datetime')).toEqual({ value: '2024-06-15T12:30:00.000Z' });
            expect(coerceValue('not a time', 'datetime').error).toContain('not a valid date and time');
        });

        it('checks email shape', () => {
            expect(coerceValue('a@b.co', 'email')).toEqual({ value: 'a@b.co' });
            expect(coerceValue('nope', 'email').error).toContain('not a valid email');
        });

        it('trims and passes other text through', () => {
            expect(coerceValue('  Acme  ', 'text')).toEqual({ value: 'Acme' });
            expect(coerceValue('Prospect', 'picklist')).toEqual({ value: 'Prospect' });
        });
    });

    describe('buildRecords', () => {
        const mapping = ['Name', 'AnnualRevenue', 'Active__c'];

        it('builds typed records and numbers rows the way a spreadsheet does (header is row 1)', () => {
            const { records, errors } = buildRecords({
                rows: [
                    ['Acme', '1,000', 'yes'],
                    ['Globex', '250.5', 'no']
                ],
                mapping,
                fields: FIELDS
            });

            expect(errors).toEqual([]);
            expect(records).toEqual([
                { rowNumber: 2, fields: { Name: 'Acme', AnnualRevenue: 1000, Active__c: true } },
                { rowNumber: 3, fields: { Name: 'Globex', AnnualRevenue: 250.5, Active__c: false } }
            ]);
        });

        it('collects every problem in a row, and leaves that row out of the records', () => {
            const { records, errors, invalidRowCount } = buildRecords({
                rows: [
                    ['Acme', 'lots', 'maybe'],
                    ['Globex', '5', 'no']
                ],
                mapping,
                fields: FIELDS
            });

            expect(invalidRowCount).toBe(1);
            expect(records.map((r) => r.rowNumber)).toEqual([3]);
            expect(errors).toEqual([
                { rowNumber: 2, fieldLabel: 'Annual Revenue', message: expect.stringContaining('not a valid number') },
                { rowNumber: 2, fieldLabel: 'Active', message: expect.stringContaining('not a valid true/false') }
            ]);
        });

        it('requires required fields on rows that create records', () => {
            const { records, errors } = buildRecords({ rows: [['', '5', '']], mapping, fields: FIELDS });

            expect(records).toEqual([]);
            expect(errors).toEqual([{ rowNumber: 2, fieldLabel: 'Account Name', message: 'A value is required.' }]);
        });

        it('does not require required fields on rows that update by Id, and does not blank empty cells', () => {
            const { records, errors } = buildRecords({
                rows: [['001000000000001AAA', '', '99']],
                mapping: [ID_FIELD, 'Name', 'AnnualRevenue'],
                fields: FIELDS
            });

            expect(errors).toEqual([]);
            expect(records).toEqual([{ rowNumber: 2, fields: { Id: '001000000000001AAA', AnnualRevenue: 99 } }]);
        });

        it('rejects a malformed Id', () => {
            const { errors } = buildRecords({
                rows: [['not-an-id', 'Acme']],
                mapping: [ID_FIELD, 'Name'],
                fields: FIELDS
            });

            expect(errors).toEqual([{ rowNumber: 2, fieldLabel: 'Id', message: '"not-an-id" is not a valid Salesforce Id.' }]);
        });

        it('treats a row with an empty Id cell as a new record', () => {
            const { records, errors } = buildRecords({
                rows: [['', 'Acme']],
                mapping: [ID_FIELD, 'Name'],
                fields: FIELDS
            });

            expect(errors).toEqual([]);
            expect(records).toEqual([{ rowNumber: 2, fields: { Name: 'Acme' } }]);
        });

        it('skips and counts rows whose mapped cells are all blank, instead of reporting missing required values', () => {
            const { records, errors, emptyRowCount, invalidRowCount } = buildRecords({
                rows: [
                    ['', '', ''],
                    ['Acme', '', '']
                ],
                mapping,
                fields: FIELDS
            });

            expect(emptyRowCount).toBe(1);
            expect(invalidRowCount).toBe(0);
            expect(errors).toEqual([]);
            expect(records.map((r) => r.rowNumber)).toEqual([3]);
        });

        it('treats a row with data only in unmapped columns as blank', () => {
            const { emptyRowCount, records } = buildRecords({
                rows: [['', 'ignored note']],
                mapping: ['Name', ''],
                fields: FIELDS
            });

            expect(emptyRowCount).toBe(1);
            expect(records).toEqual([]);
        });
    });
});
