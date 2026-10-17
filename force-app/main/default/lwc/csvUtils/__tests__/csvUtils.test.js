import { escapeCsvValue, rowsToCsv, downloadCsv, exportRowsToCsv } from 'c/csvUtils';

describe('csvUtils', () => {
    describe('escapeCsvValue', () => {
        it('returns empty string for nullish values', () => {
            expect(escapeCsvValue(null)).toBe('');
            expect(escapeCsvValue(undefined)).toBe('');
        });

        it('leaves plain values unquoted', () => {
            expect(escapeCsvValue('Acme')).toBe('Acme');
            expect(escapeCsvValue(42)).toBe('42');
        });

        it('quotes values containing commas, quotes, or newlines', () => {
            expect(escapeCsvValue('Acme, Inc.')).toBe('"Acme, Inc."');
            expect(escapeCsvValue('Say "hi"')).toBe('"Say ""hi"""');
            expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
        });
    });

    describe('rowsToCsv', () => {
        it('builds a header and rows from datatable-style columns', () => {
            const columns = [
                { label: 'Account Name', fieldName: 'Name' },
                { label: 'Industry', fieldName: 'Industry' }
            ];
            const rows = [
                { Name: 'Acme', Industry: 'Tech' },
                { Name: 'Globex', Industry: 'Energy' }
            ];

            expect(rowsToCsv(rows, columns)).toBe(
                'Account Name,Industry\nAcme,Tech\nGlobex,Energy'
            );
        });

        it('accepts plain field-name strings as columns', () => {
            expect(rowsToCsv([{ Name: 'Acme' }], ['Name'])).toBe('Name\nAcme');
        });

        it('reads flattened relationship aliases used by enterpriseDatatable', () => {
            const columns = [{ label: 'Owner', fieldName: 'Owner.Name' }];
            const rows = [{ Owner_Name: 'Ada Lovelace' }];

            expect(rowsToCsv(rows, columns)).toBe('Owner\nAda Lovelace');
        });

        it('escapes cell values that need quoting', () => {
            const columns = [{ label: 'Name', fieldName: 'Name' }];
            const rows = [{ Name: 'Acme, Inc.' }];

            expect(rowsToCsv(rows, columns)).toBe('Name\n"Acme, Inc."');
        });

        it('returns only a header when there are no rows', () => {
            expect(rowsToCsv([], [{ label: 'Name', fieldName: 'Name' }])).toBe('Name');
        });
    });

    describe('downloadCsv', () => {
        let createObjectURL;
        let revokeObjectURL;
        let appendChild;
        let removeChild;
        let click;

        beforeEach(() => {
            createObjectURL = jest.fn(() => 'blob:mock-url');
            revokeObjectURL = jest.fn();
            URL.createObjectURL = createObjectURL;
            URL.revokeObjectURL = revokeObjectURL;

            appendChild = jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
            removeChild = jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
            click = jest.fn();
            jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                if (tag === 'a') {
                    return { href: '', style: {}, setAttribute: jest.fn(), click };
                }
                return document.createElement.bind(document)(tag);
            });
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('creates a blob download link and cleans up', () => {
            downloadCsv('accounts.csv', 'Name\nAcme');

            expect(createObjectURL).toHaveBeenCalled();
            expect(click).toHaveBeenCalled();
            expect(appendChild).toHaveBeenCalled();
            expect(removeChild).toHaveBeenCalled();
            expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        });

        it('appends .csv when the filename has no extension', () => {
            const setAttribute = jest.fn();
            document.createElement.mockImplementation((tag) => {
                if (tag === 'a') {
                    return { href: '', style: {}, setAttribute, click };
                }
                return {};
            });

            downloadCsv('accounts', 'Name\nAcme');
            expect(setAttribute).toHaveBeenCalledWith('download', 'accounts.csv');
        });
    });

    describe('exportRowsToCsv', () => {
        it('returns the CSV content and triggers a download', () => {
            URL.createObjectURL = jest.fn(() => 'blob:mock-url');
            URL.revokeObjectURL = jest.fn();
            jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
            jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
            jest.spyOn(document, 'createElement').mockReturnValue({
                href: '',
                style: {},
                setAttribute: jest.fn(),
                click: jest.fn()
            });

            const csv = exportRowsToCsv([{ Name: 'Acme' }], [{ label: 'Name', fieldName: 'Name' }], 'out.csv');
            expect(csv).toBe('Name\nAcme');
        });
    });
});
