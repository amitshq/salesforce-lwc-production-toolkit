import { publish, subscribe, unsubscribe } from 'lightning/messageService';
import { publishMessage, subscribeToChannel, unsubscribeFromChannel, createChannelController } from 'c/lmsUtils';

const FAKE_CONTEXT = { fake: 'context' };
const FAKE_CHANNEL = { fake: 'channel' };

describe('lmsUtils', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('publishMessage delegates to publish() with the given context/channel/payload', () => {
        publishMessage(FAKE_CONTEXT, FAKE_CHANNEL, { recordId: '001' });
        expect(publish).toHaveBeenCalledWith(FAKE_CONTEXT, FAKE_CHANNEL, { recordId: '001' });
    });

    it('subscribeToChannel delegates to subscribe() and returns its result', () => {
        const fakeSubscription = { id: 1 };
        subscribe.mockReturnValue(fakeSubscription);
        const callback = jest.fn();

        const result = subscribeToChannel(FAKE_CONTEXT, FAKE_CHANNEL, callback);

        expect(subscribe).toHaveBeenCalledWith(FAKE_CONTEXT, FAKE_CHANNEL, callback, undefined);
        expect(result).toBe(fakeSubscription);
    });

    it('unsubscribeFromChannel is a no-op for a falsy subscription', () => {
        unsubscribeFromChannel(null);
        expect(unsubscribe).not.toHaveBeenCalled();
    });

    it('unsubscribeFromChannel delegates to unsubscribe() for a real subscription', () => {
        const fakeSubscription = { id: 1 };
        unsubscribeFromChannel(fakeSubscription);
        expect(unsubscribe).toHaveBeenCalledWith(fakeSubscription);
    });

    describe('createChannelController', () => {
        it('publish() delegates through to the underlying publish()', () => {
            const controller = createChannelController(FAKE_CONTEXT, FAKE_CHANNEL);
            controller.publish({ recordId: '001' });
            expect(publish).toHaveBeenCalledWith(FAKE_CONTEXT, FAKE_CHANNEL, { recordId: '001' });
        });

        it('subscribing twice unsubscribes the first subscription before creating the second', () => {
            const firstSub = { id: 'first' };
            const secondSub = { id: 'second' };
            subscribe.mockReturnValueOnce(firstSub).mockReturnValueOnce(secondSub);

            const controller = createChannelController(FAKE_CONTEXT, FAKE_CHANNEL);
            controller.subscribe(jest.fn());
            controller.subscribe(jest.fn());

            expect(unsubscribe).toHaveBeenCalledWith(firstSub);
            expect(unsubscribe).not.toHaveBeenCalledWith(secondSub);
        });

        it('unsubscribe() clears the tracked subscription so a later unsubscribe() is a no-op', () => {
            const sub = { id: 1 };
            subscribe.mockReturnValue(sub);
            const controller = createChannelController(FAKE_CONTEXT, FAKE_CHANNEL);

            controller.subscribe(jest.fn());
            controller.unsubscribe();
            controller.unsubscribe();

            expect(unsubscribe).toHaveBeenCalledTimes(1);
        });
    });
});
