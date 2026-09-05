import { safeParse, safeStringify, prettyPrint, isValidJson } from 'c/jsonUtils';

describe('jsonUtils', () => {
    describe('safeParse', () => {
        it('parses valid JSON', () => {
            expect(safeParse('{"a":1}')).toEqual({ a: 1 });
        });

        it('returns the fallback for invalid JSON instead of throwing', () => {
            expect(safeParse('{not json', 'fallback')).toBe('fallback');
            expect(safeParse(undefined, [])).toEqual([]);
        });
    });

    describe('safeStringify', () => {
        it('stringifies a value', () => {
            expect(safeStringify({ a: 1 })).toBe('{"a":1}');
        });

        it('returns the fallback for circular structures instead of throwing', () => {
            const circular = {};
            circular.self = circular;
            expect(safeStringify(circular, 'fallback')).toBe('fallback');
        });
    });

    describe('prettyPrint', () => {
        it('formats a JS value with indentation', () => {
            expect(prettyPrint({ a: 1 })).toBe('{\n  "a": 1\n}');
        });

        it('formats a JSON string by round-tripping it', () => {
            expect(prettyPrint('{"a":1}')).toBe('{\n  "a": 1\n}');
        });

        it('falls back to the original string when it is not valid JSON', () => {
            expect(prettyPrint('not json')).toBe('not json');
        });
    });

    describe('isValidJson', () => {
        it('distinguishes valid from invalid JSON strings', () => {
            expect(isValidJson('{"a":1}')).toBe(true);
            expect(isValidJson('{not json')).toBe(false);
            expect(isValidJson(42)).toBe(false);
        });
    });
});
