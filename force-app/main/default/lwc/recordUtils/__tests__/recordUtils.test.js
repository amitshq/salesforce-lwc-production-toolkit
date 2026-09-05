import { refreshApex } from '@salesforce/apex';
import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
import { normalizeRecordIds, notifyRecordsChanged, refreshRecords } from 'c/recordUtils';

jest.mock(
    '@salesforce/apex',
    () => ({
        refreshApex: jest.fn(() => Promise.resolve())
    }),
    { virtual: true }
);

jest.mock('lightning/uiRecordApi', () => ({
    notifyRecordUpdateAvailable: jest.fn(() => Promise.resolve())
}));

describe('recordUtils', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('normalizeRecordIds', () => {
        it('wraps plain id strings into the shape the API expects', () => {
            expect(normalizeRecordIds('001xx0000000001')).toEqual([{ recordId: '001xx0000000001' }]);
        });

        it('accepts an array of ids or already-shaped objects, dropping falsy entries', () => {
            expect(normalizeRecordIds(['001xx0000000001', null, { recordId: '001xx0000000002' }])).toEqual([
                { recordId: '001xx0000000001' },
                { recordId: '001xx0000000002' }
            ]);
        });
    });

    describe('notifyRecordsChanged', () => {
        it('calls notifyRecordUpdateAvailable with normalized ids', async () => {
            await notifyRecordsChanged('001xx0000000001');
            expect(notifyRecordUpdateAvailable).toHaveBeenCalledWith([{ recordId: '001xx0000000001' }]);
        });

        it('does nothing when there are no ids', async () => {
            await notifyRecordsChanged([]);
            expect(notifyRecordUpdateAvailable).not.toHaveBeenCalled();
        });
    });

    describe('refreshRecords', () => {
        it('refreshes a wired Apex result and notifies LDS in parallel', async () => {
            const wiredResult = { data: {}, error: undefined };
            await refreshRecords(wiredResult, '001xx0000000001');

            expect(refreshApex).toHaveBeenCalledWith(wiredResult);
            expect(notifyRecordUpdateAvailable).toHaveBeenCalledWith([{ recordId: '001xx0000000001' }]);
        });

        it('only runs the tasks that were actually requested', async () => {
            await refreshRecords(undefined, '001xx0000000001');
            expect(refreshApex).not.toHaveBeenCalled();
            expect(notifyRecordUpdateAvailable).toHaveBeenCalled();
        });
    });
});
