import { parseQueryParams, buildQueryString, getQueryParam, withQueryParam, removeQueryParam } from 'c/urlUtils';

describe('urlUtils', () => {
    describe('parseQueryParams', () => {
        it('parses simple params', () => {
            expect(parseQueryParams('?a=1&b=2')).toEqual({ a: '1', b: '2' });
        });

        it('collects repeated keys into an array', () => {
            expect(parseQueryParams('?tag=x&tag=y')).toEqual({ tag: ['x', 'y'] });
        });

        it('returns an empty object for no query string', () => {
            expect(parseQueryParams('')).toEqual({});
        });
    });

    describe('buildQueryString', () => {
        it('serializes a flat object', () => {
            expect(buildQueryString({ a: 1, b: 'two' })).toBe('?a=1&b=two');
        });

        it('omits null/undefined values', () => {
            expect(buildQueryString({ a: 1, b: null, c: undefined })).toBe('?a=1');
        });

        it('repeats the key for array values', () => {
            expect(buildQueryString({ tag: ['x', 'y'] })).toBe('?tag=x&tag=y');
        });

        it('returns an empty string when there is nothing to serialize', () => {
            expect(buildQueryString({})).toBe('');
        });
    });

    describe('getQueryParam', () => {
        it('reads a single param by name', () => {
            expect(getQueryParam('a', '?a=1&b=2')).toBe('1');
            expect(getQueryParam('missing', '?a=1')).toBeNull();
        });
    });

    describe('withQueryParam / removeQueryParam', () => {
        it('sets a param on a relative URL and keeps it relative', () => {
            expect(withQueryParam('/reports/list?sort=name', 'page', '2')).toBe('/reports/list?sort=name&page=2');
        });

        it('overwrites an existing param', () => {
            expect(withQueryParam('/reports/list?page=1', 'page', '2')).toBe('/reports/list?page=2');
        });

        it('removes a param while preserving the rest', () => {
            expect(removeQueryParam('/reports/list?page=2&sort=name', 'page')).toBe('/reports/list?sort=name');
        });
    });
});
