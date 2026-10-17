import { subscribe, unsubscribe } from 'lightning/empApi';
import { getChangeEventChannel, normalizeChangeEvent, subscribeToObjectChanges } from 'c/empUtils';

describe('empUtils', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getChangeEventChannel', () => {
        it('uses <Object>ChangeEvent for standard objects', () => {
            expect(getChangeEventChannel('Account')).toBe('/data/AccountChangeEvent');
        });

        it('swaps the __c suffix for custom objects', () => {
            expect(getChangeEventChannel('Invoice__c')).toBe('/data/Invoice__ChangeEvent');
        });

        it('keeps a namespace on custom objects', () => {
            expect(getChangeEventChannel('acme__Invoice__c')).toBe('/data/acme__Invoice__ChangeEvent');
        });

        it('trims whitespace', () => {
            expect(getChangeEventChannel('  Contact ')).toBe('/data/ContactChangeEvent');
        });

        it('refuses a missing object name', () => {
            expect(() => getChangeEventChannel('')).toThrow('object API name is required');
            expect(() => getChangeEventChannel(undefined)).toThrow('object API name is required');
        });
    });

    describe('normalizeChangeEvent', () => {
        it('lifts the useful fields out of the platform envelope', () => {
            const message = {
                channel: '/data/AccountChangeEvent',
                data: {
                    payload: {
                        ChangeEventHeader: {
                            changeType: 'UPDATE',
                            entityName: 'Account',
                            recordIds: ['001A', '001B'],
                            commitUser: '005X'
                        }
                    }
                }
            };

            expect(normalizeChangeEvent(message)).toEqual({
                changeType: 'UPDATE',
                entityName: 'Account',
                recordIds: ['001A', '001B'],
                commitUser: '005X',
                raw: message
            });
        });

        it('copes with a message that has no header', () => {
            expect(normalizeChangeEvent({})).toEqual({
                changeType: undefined,
                entityName: undefined,
                recordIds: [],
                commitUser: undefined,
                raw: {}
            });
            expect(normalizeChangeEvent(undefined).recordIds).toEqual([]);
        });
    });

    describe('subscribeToObjectChanges', () => {
        it('subscribes to the object\'s channel for new events only', async () => {
            subscribe.mockResolvedValue({ id: 'sub-1' });

            await subscribeToObjectChanges('Account', jest.fn());

            expect(subscribe).toHaveBeenCalledWith('/data/AccountChangeEvent', -1, expect.any(Function));
        });

        it('hands the callback a normalized change', async () => {
            subscribe.mockResolvedValue({ id: 'sub-1' });
            const onChange = jest.fn();
            await subscribeToObjectChanges('Account', onChange);

            const deliver = subscribe.mock.calls[0][2];
            deliver({ data: { payload: { ChangeEventHeader: { changeType: 'DELETE', recordIds: ['001A'] } } } });

            expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ changeType: 'DELETE', recordIds: ['001A'] }));
        });

        it('resolves to a function that unsubscribes once, however often it is called', async () => {
            const subscription = { id: 'sub-1' };
            subscribe.mockResolvedValue(subscription);
            unsubscribe.mockResolvedValue({});
            const stop = await subscribeToObjectChanges('Account', jest.fn());

            await stop();
            await stop();

            expect(unsubscribe).toHaveBeenCalledTimes(1);
            expect(unsubscribe).toHaveBeenCalledWith(subscription, expect.any(Function));
        });

        it('rejects when the subscription cannot be made, so the caller can say live updates are off', async () => {
            subscribe.mockRejectedValue(new Error('The requested channel does not exist.'));

            await expect(subscribeToObjectChanges('Account', jest.fn())).rejects.toThrow('channel does not exist');
        });

        it('rejects without subscribing when there is no object name', async () => {
            await expect(subscribeToObjectChanges('', jest.fn())).rejects.toThrow('object API name is required');
            expect(subscribe).not.toHaveBeenCalled();
        });
    });
});
