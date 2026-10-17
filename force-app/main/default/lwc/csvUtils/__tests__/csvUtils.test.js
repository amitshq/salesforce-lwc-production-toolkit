import { escapeCsvValue, neutralizeFormula, rowsToCsv, downloadCsv, exportRowsToCsv } from 'c/csvUtils';

const realCreateElement = document.createElement.bind(document);

describe('csvUtils', () => {
    describe('escapeCsvValue', () => {
        it('returns empty string for nullish values', () => {
            expect(escapeCsvValue(null)).toBe('');
            expect(escapeCsvValue(undefined)).toBe('');
        });

        it('leaves plain values unquoted', () => {
            expect(escapeCsvValue('Acme')).toBe('Acme');
            expect(escapeCsvValue(42)).toBe('42');
            expect(escapeCsvValue(0)).toBe('0');
            expect(escapeCsvValue(false)).toBe('false');
        });

        it('quotes values containing commas, quotes, or newlines', () => {
            expect(escapeCsvValue('Acme, Inc.')).toBe('"Acme, Inc."');
            expect(escapeCsvValue('Say "hi"')).toBe('"Say ""hi"""');
            expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
        });

        it('writes Dates as ISO strings', () => {
            expect(escapeCsvValue(new Date('2024-06-15T12:00:00Z'))).toBe('2024-06-15T12:00:00.000Z');
        });

        it('joins arrays with "; " instead of relying on Array toString', () => {
            expect(escapeCsvValue(['a', 'b'])).toBe('a; b');
        });

        it('JSON-encodes plain objects instead of writing [object Object]', () => {
            expect(escapeCsvValue({ x: 1 })).toBe('"{""x"":1}"');
        });
    });

    describe('neutralizeFormula', () => {
        it.each(['=SUM(1,2)', '@SUM(1+1)', '+cmd|calc', '-2+3', '\tTabbed', '\rReturn'])(
            'prefixes %j so it opens as text',
            (value) => {
                expect(neutralizeFormula(value)).toBe(`'${value}`);
            }
        );

        it('leaves ordinary text, numbers and plain numeric strings alone', () => {
            expect(neutralizeFormula('Acme')).toBe('Acme');
            expect(neutralizeFormula(-5)).toBe(-5);
            expect(neutralizeFormula('-5')).toBe('-5');
            expect(neutralizeFormula('+12.50')).toBe('+12.50');
            expect(neutralizeFormula(null)).toBeNull();
        });
    });

    describe('rowsToCsv', () => {
        it('builds a header and rows from datatable-style columns, separated by CRLF', () => {
            const columns = [
                { label: 'Account Name', fieldName: 'Name' },
                { label: 'Industry', fieldName: 'Industry' }
            ];
            const rows = [
                { Name: 'Acme', Industry: 'Tech' },
                { Name: 'Globex', Industry: 'Energy' }
            ];

            expect(rowsToCsv(rows, columns)).toBe('Account Name,Industry\r\nAcme,Tech\r\nGlobex,Energy');
        });

        it('accepts plain field-name strings as columns', () => {
            expect(rowsToCsv([{ Name: 'Acme' }], ['Name'])).toBe('Name\r\nAcme');
        });

        it('reads flattened relationship aliases used by enterpriseDatatable', () => {
            const columns = [{ label: 'Owner', fieldName: 'Owner.Name' }];
            const rows = [{ Owner_Name: 'Ada Lovelace' }];

            expect(rowsToCsv(rows, columns)).toBe('Owner\r\nAda Lovelace');
        });

        it('reads nested relationship objects from raw Apex records that were not pre-flattened', () => {
            const columns = [{ label: 'Owner', fieldName: 'Owner.Name' }];
            const rows = [{ Id: '001', Owner: { Name: 'Ada Lovelace' } }];

            expect(rowsToCsv(rows, columns)).toBe('Owner\r\nAda Lovelace');
        });

        it('escapes cell values that need quoting', () => {
            const columns = [{ label: 'Name', fieldName: 'Name' }];
            const rows = [{ Name: 'Acme, Inc.' }];

            expect(rowsToCsv(rows, columns)).toBe('Name\r\n"Acme, Inc."');
        });

        it('returns only a header when there are no rows', () => {
            expect(rowsToCsv([], [{ label: 'Name', fieldName: 'Name' }])).toBe('Name');
        });

        it('skips columns without a fieldName, such as row-action columns', () => {
            const columns = [{ label: 'Name', fieldName: 'Name' }, { type: 'action', typeAttributes: { rowActions: [] } }];

            expect(rowsToCsv([{ Name: 'Acme' }], columns)).toBe('Name\r\nAcme');
        });

        it('skips null rows instead of throwing', () => {
            expect(rowsToCsv([null, { Name: 'Acme' }], ['Name'])).toBe('Name\r\nAcme');
        });

        it('neutralizes formula-looking text by default', () => {
            const rows = [{ Name: '=HYPERLINK("http://evil.example","Click")' }, { Name: '@SUM(1+1)' }];

            expect(rowsToCsv(rows, ['Name'])).toBe(
                'Name\r\n"\'=HYPERLINK(""http://evil.example"",""Click"")"\r\n\'@SUM(1+1)'
            );
        });

        it('does not alter negative numbers', () => {
            expect(rowsToCsv([{ Amount: -250.5 }, { Amount: '-5' }], ['Amount'])).toBe('Amount\r\n-250.5\r\n-5');
        });

        it('can opt out of formula neutralization', () => {
            expect(rowsToCsv([{ Name: '=1+1' }], ['Name'], { neutralizeFormulas: false })).toBe('Name\r\n=1+1');
        });
    });

    describe('downloadCsv', () => {
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        const OriginalBlob = global.Blob;
        let click;
        let setAttribute;
        let blobParts;

        beforeEach(() => {
            jest.useFakeTimers();
            URL.createObjectURL = jest.fn(() => 'blob:mock-url');
            URL.revokeObjectURL = jest.fn();

            blobParts = undefined;
            global.Blob = function MockBlob(parts, options) {
                blobParts = parts;
                return new OriginalBlob(parts, options);
            };

            click = jest.fn();
            setAttribute = jest.fn();
            jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
            jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
            jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'a') {
                    return { href: '', style: {}, setAttribute, click };
                }
                return realCreateElement(tag);
            });
        });

        afterEach(() => {
            jest.restoreAllMocks();
            jest.useRealTimers();
            global.Blob = OriginalBlob;
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
        });

        it('creates a blob download link and removes it from the page', () => {
            downloadCsv('accounts.csv', 'Name\r\nAcme');

            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(setAttribute).toHaveBeenCalledWith('download', 'accounts.csv');
            expect(click).toHaveBeenCalled();
            expect(document.body.appendChild).toHaveBeenCalled();
            expect(document.body.removeChild).toHaveBeenCalled();
        });

        it('appends .csv when the filename has no extension', () => {
            downloadCsv('accounts', 'Name\r\nAcme');
            expect(setAttribute).toHaveBeenCalledWith('download', 'accounts.csv');
        });

        it('prepends a UTF-8 BOM so Excel reads non-ASCII text correctly', () => {
            downloadCsv('accounts.csv', 'Name\r\nÉlan');

            expect(blobParts).toEqual(['﻿', 'Name\r\nÉlan']);
        });

        it('revokes the object URL after a delay, not synchronously after the click', () => {
            downloadCsv('accounts.csv', 'Name');
            expect(URL.revokeObjectURL).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1000);
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        });
    });

    describe('exportRowsToCsv', () => {
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;

        beforeEach(() => {
            jest.useFakeTimers();
            URL.createObjectURL = jest.fn(() => 'blob:mock-url');
            URL.revokeObjectURL = jest.fn();
            jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
            jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
            jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'a') {
                    return { href: '', style: {}, setAttribute: jest.fn(), click: jest.fn() };
                }
                return realCreateElement(tag);
            });
        });

        afterEach(() => {
            jest.restoreAllMocks();
            jest.useRealTimers();
            URL.createObjectURL = originalCreateObjectURL;
            URL.revokeObjectURL = originalRevokeObjectURL;
        });

        it('returns the CSV content and triggers a download', () => {
            const csv = exportRowsToCsv([{ Name: 'Acme' }], [{ label: 'Name', fieldName: 'Name' }], 'out.csv');

            expect(csv).toBe('Name\r\nAcme');
            expect(URL.createObjectURL).toHaveBeenCalled();
        });

        it('passes options through to rowsToCsv', () => {
            const csv = exportRowsToCsv([{ Name: '=1+1' }], ['Name'], 'out.csv', { neutralizeFormulas: false });

            expect(csv).toBe('Name\r\n=1+1');
        });
    });
});
