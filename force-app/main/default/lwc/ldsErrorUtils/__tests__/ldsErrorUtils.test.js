import { reduceLdsErrors, reduceLdsErrorMessage } from 'c/ldsErrorUtils';

describe('ldsErrorUtils', () => {
    it('extracts UI API page-level output errors', () => {
        const error = { body: { output: { errors: [{ message: 'Record is read-only' }] } } };
        expect(reduceLdsErrors(error)).toEqual(['Record is read-only']);
    });

    it('extracts and flattens UI API field errors', () => {
        const error = {
            body: {
                output: {
                    fieldErrors: {
                        Name: [{ message: 'Name is required' }]
                    }
                }
            }
        };
        expect(reduceLdsErrors(error)).toEqual(['Name is required']);
    });

    it('falls back to body.message when there is no output', () => {
        expect(reduceLdsErrors({ body: { message: 'Entity is deleted' } })).toEqual(['Entity is deleted']);
    });

    it('handles the array-of-errors shape from a @wire adapter', () => {
        const errors = [
            { body: { output: { errors: [{ message: 'First' }] } } },
            { body: { output: { errors: [{ message: 'Second' }] } } }
        ];
        expect(reduceLdsErrors(errors)).toEqual(['First', 'Second']);
    });

    it('falls back to "Unknown error" when nothing usable is present', () => {
        expect(reduceLdsErrors({})).toEqual(['Unknown error']);
    });

    it('reduceLdsErrorMessage joins messages with the given separator', () => {
        const error = { body: { output: { errors: [{ message: 'A' }, { message: 'B' }] } } };
        expect(reduceLdsErrorMessage(error, ' | ')).toBe('A | B');
    });
});
