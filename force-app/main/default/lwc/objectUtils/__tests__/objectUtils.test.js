import { deepClone, isEqual, getNestedValue, setNestedValue } from 'c/objectUtils';

describe('objectUtils', () => {
    describe('deepClone', () => {
        it('produces an equal but independent copy of nested structures', () => {
            const original = { a: 1, nested: { b: [1, 2, { c: 3 }] } };
            const clone = deepClone(original);

            expect(clone).toEqual(original);
            expect(clone).not.toBe(original);
            expect(clone.nested).not.toBe(original.nested);
            expect(clone.nested.b).not.toBe(original.nested.b);

            clone.nested.b[2].c = 999;
            expect(original.nested.b[2].c).toBe(3);
        });

        it('clones Date, Map and Set instances', () => {
            const original = { when: new Date('2024-01-01T00:00:00Z'), map: new Map([['k', 1]]), set: new Set([1, 2]) };
            const clone = deepClone(original);

            expect(clone.when).not.toBe(original.when);
            expect(clone.when.getTime()).toBe(original.when.getTime());
            expect(clone.map).not.toBe(original.map);
            expect(clone.map.get('k')).toBe(1);
            expect(clone.set.has(2)).toBe(true);
        });

        it('passes primitives through unchanged', () => {
            expect(deepClone(5)).toBe(5);
            expect(deepClone(null)).toBeNull();
            expect(deepClone('x')).toBe('x');
        });
    });

    describe('isEqual', () => {
        it('treats deeply identical objects as equal regardless of reference', () => {
            expect(isEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
        });

        it('detects differences at any depth', () => {
            expect(isEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
            expect(isEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
            expect(isEqual([1, 2], [1, 2, 3])).toBe(false);
        });

        it('compares Date values by time', () => {
            expect(isEqual(new Date('2024-01-01'), new Date('2024-01-01'))).toBe(true);
            expect(isEqual(new Date('2024-01-01'), new Date('2024-01-02'))).toBe(false);
        });
    });

    describe('getNestedValue', () => {
        const source = { account: { contacts: [{ email: 'a@example.com' }] } };

        it('reads dot and bracket paths', () => {
            expect(getNestedValue(source, 'account.contacts[0].email')).toBe('a@example.com');
            expect(getNestedValue(source, 'account.contacts.0.email')).toBe('a@example.com');
        });

        it('returns the default value for a missing path instead of throwing', () => {
            expect(getNestedValue(source, 'account.contacts[5].email', 'none')).toBe('none');
            expect(getNestedValue(source, 'missing.path', 'fallback')).toBe('fallback');
        });
    });

    describe('setNestedValue', () => {
        it('sets a deep value without mutating the original object', () => {
            const source = { account: { name: 'Acme' } };
            const updated = setNestedValue(source, 'account.name', 'Updated');

            expect(updated.account.name).toBe('Updated');
            expect(source.account.name).toBe('Acme');
            expect(updated).not.toBe(source);
        });

        it('creates missing intermediate objects and arrays as needed', () => {
            const updated = setNestedValue({}, 'contacts[0].email', 'a@example.com');
            expect(updated.contacts[0].email).toBe('a@example.com');
            expect(Array.isArray(updated.contacts)).toBe(true);
        });
    });
});
