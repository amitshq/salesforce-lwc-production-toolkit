import {
    normalizeRowActions,
    recordUrl,
    relatedIdPath,
    toChunks,
    compareRows,
    sortRows,
    richTextToPlainText,
    formatNumber
} from 'c/datatableHelpers';

describe('datatableHelpers', () => {
    describe('normalizeRowActions', () => {
        it('reads a comma-separated list and labels the built-in actions', () => {
            expect(normalizeRowActions(' view, edit ,delete,')).toEqual([
                { label: 'View', name: 'view' },
                { label: 'Edit', name: 'edit' },
                { label: 'Delete', name: 'delete' }
            ]);
        });

        it('keeps custom actions and their own labels, and drops duplicates and blanks', () => {
            expect(
                normalizeRowActions(['view', { name: 'call', label: 'Log a call', iconName: 'utility:call' }, { name: 'view' }, { label: 'No name' }, null, 'archive'])
            ).toEqual([
                { label: 'View', name: 'view' },
                { label: 'Log a call', name: 'call', iconName: 'utility:call' },
                { label: 'archive', name: 'archive' }
            ]);
        });

        it('lets a built-in action be relabelled', () => {
            expect(normalizeRowActions([{ name: 'delete', label: 'Remove' }])).toEqual([{ label: 'Remove', name: 'delete' }]);
        });

        it('treats anything else as no actions', () => {
            expect(normalizeRowActions(undefined)).toEqual([]);
            expect(normalizeRowActions(42)).toEqual([]);
        });
    });

    it('builds record URLs from a template, and none without an Id', () => {
        expect(recordUrl('/lightning/r/{recordId}/view', '001A')).toBe('/lightning/r/001A/view');
        expect(recordUrl('/s/detail/{recordId}?from={recordId}', '001A')).toBe('/s/detail/001A?from=001A');
        expect(recordUrl(undefined, '001A')).toBe('/lightning/r/001A/view');
        expect(recordUrl('/x/{recordId}', 'a b')).toBe('/x/a%20b');
        expect(recordUrl('/x/{recordId}', null)).toBeUndefined();
    });

    it('finds the related record Id path of a relationship path', () => {
        expect(relatedIdPath('Owner.Name')).toBe('Owner.Id');
        expect(relatedIdPath('Account.Owner.Name')).toBe('Account.Owner.Id');
    });

    it('splits lists into chunks', () => {
        expect(toChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(toChunks([], 2)).toEqual([]);
        expect(toChunks([1, 2], 0)).toEqual([[1], [2]]);
    });

    describe('compareRows and sortRows', () => {
        const rows = [
            { Id: '1', Name: 'beta', Amount: 10, Owner_Name: 'Zed' },
            { Id: '2', Name: null, Amount: 5, Owner: { Name: 'amy' } },
            { Id: '3', Name: 'Alpha', Amount: null, Owner_Name: 'Bob' },
            { Id: '4', Name: 'alpha', Amount: 10, Owner_Name: '' }
        ];

        it('sorts text without regard to case, and keeps ties in their original order', () => {
            expect(sortRows(rows, 'Name', 'asc').map((row) => row.Id)).toEqual(['3', '4', '1', '2']);
        });

        it('puts empty values last in both directions, as the query does', () => {
            expect(sortRows(rows, 'Name', 'desc').map((row) => row.Id)).toEqual(['1', '3', '4', '2']);
            expect(sortRows(rows, 'Amount', 'desc').map((row) => row.Id)).toEqual(['1', '4', '2', '3']);
            expect(sortRows(rows, 'Amount', 'ASC').map((row) => row.Id)).toEqual(['2', '1', '4', '3']);
        });

        it('reads relationship paths from the flattened alias or the nested record', () => {
            expect(sortRows(rows, 'Owner.Name', 'asc').map((row) => row.Id)).toEqual(['2', '3', '1', '4']);
        });

        it('compares booleans and leaves rows alone without a sort field', () => {
            expect(compareRows({ Done: true }, { Done: false }, 'Done', 'asc')).toBeGreaterThan(0);
            expect(sortRows(rows, undefined).map((row) => row.Id)).toEqual(['1', '2', '3', '4']);
            expect(sortRows(rows, 'Name')).not.toBe(rows);
        });
    });

    it('turns rich text into plain text for a CSV cell', () => {
        expect(richTextToPlainText('<p>Call <b>back</b> &amp; confirm</p><p>Line&nbsp;two<br/>three</p>')).toBe(
            'Call back & confirm\nLine two\nthree'
        );
        expect(richTextToPlainText(null)).toBe('');
        expect(richTextToPlainText('&lt;not a tag&gt; &quot;quoted&quot; &#39;single&#39;')).toBe('<not a tag> "quoted" \'single\'');
    });

    it('formats numbers, currency and percentages in the user locale', () => {
        expect(formatNumber(1234.567)).toBe('1,234.57');
        expect(formatNumber(1234.5, 'currency')).toBe('$1,234.50');
        expect(formatNumber(99, 'currency', 'EUR')).toBe('€99.00');
        expect(formatNumber(12.5, 'percent')).toBe('12.5%');
        expect(formatNumber(null)).toBe('—');
        expect(formatNumber('n/a')).toBe('n/a');
    });
});
