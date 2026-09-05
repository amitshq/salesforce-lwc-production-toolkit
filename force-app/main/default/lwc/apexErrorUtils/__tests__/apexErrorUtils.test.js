import { reduceApexErrors, reduceApexErrorMessage } from 'c/apexErrorUtils';

describe('apexErrorUtils', () => {
    it('extracts a single AuraHandledException message', () => {
        const error = { body: { message: 'Unknown object: Foo__x' } };
        expect(reduceApexErrors(error)).toEqual(['Unknown object: Foo__x']);
    });

    it('extracts page-level DML errors', () => {
        const error = { body: { pageErrors: [{ message: 'Required fields are missing' }] } };
        expect(reduceApexErrors(error)).toEqual(['Required fields are missing']);
    });

    it('extracts and flattens field-level DML errors', () => {
        const error = {
            body: {
                fieldErrors: {
                    Name: [{ message: 'Name is required' }],
                    Industry: [{ message: 'Invalid value' }]
                }
            }
        };
        expect(reduceApexErrors(error)).toEqual(expect.arrayContaining(['Name is required', 'Invalid value']));
    });

    it('handles the array-of-errors shape from a @wire Apex method', () => {
        const errors = [{ body: { message: 'First failure' } }, { body: { message: 'Second failure' } }];
        expect(reduceApexErrors(errors)).toEqual(['First failure', 'Second failure']);
    });

    it('falls back to a JS Error message when there is no body', () => {
        expect(reduceApexErrors(new Error('boom'))).toEqual(['boom']);
    });

    it('falls back to "Unknown error" when nothing usable is present', () => {
        expect(reduceApexErrors({})).toEqual(['Unknown error']);
        expect(reduceApexErrors(null)).toEqual(['Unknown error']);
    });

    it('reduceApexErrorMessage joins messages with the given separator', () => {
        const errors = [{ body: { message: 'A' } }, { body: { message: 'B' } }];
        expect(reduceApexErrorMessage(errors, ' | ')).toBe('A | B');
    });
});
