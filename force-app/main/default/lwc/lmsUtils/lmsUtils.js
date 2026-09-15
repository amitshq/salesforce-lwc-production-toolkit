import { publish, subscribe, unsubscribe } from 'lightning/messageService';

/**
 * Thin wrapper around Lightning Message Service. Like navigationUtils, it
 * can't wire `MessageContext` itself (only a component can), so every
 * function takes the calling component's wired context as the first
 * argument.
 *
 * @example
 * import { MessageContext } from 'lightning/messageService';
 * import TOOLKIT_CHANNEL from '@salesforce/messageChannel/ToolkitMessageChannel__c';
 * import { createChannelController } from 'c/lmsUtils';
 *
 * export default class MyComponent extends LightningElement {
 *     @wire(MessageContext) messageContext;
 *     channel;
 *
 *     connectedCallback() {
 *         this.channel = createChannelController(this.messageContext, TOOLKIT_CHANNEL);
 *         this.channel.subscribe((message) => this.handleMessage(message));
 *     }
 *
 *     disconnectedCallback() {
 *         this.channel.unsubscribe();
 *     }
 *
 *     notifyOthers(recordId) {
 *         this.channel.publish({ recordId });
 *     }
 * }
 */

export function publishMessage(messageContext, channel, payload) {
    publish(messageContext, channel, payload);
}

export function subscribeToChannel(messageContext, channel, callback, options) {
    return subscribe(messageContext, channel, callback, options);
}

export function unsubscribeFromChannel(subscription) {
    if (subscription) {
        unsubscribe(subscription);
    }
}

/**
 * Bundles a context + channel into publish/subscribe/unsubscribe methods
 * that track their own subscription reference, so calling subscribe() a
 * second time (e.g. from a re-run lifecycle hook) can't silently create a
 * duplicate subscription - it replaces the first one instead.
 * @returns {{publish: Function, subscribe: Function, unsubscribe: Function}}
 */
export function createChannelController(messageContext, channel) {
    let activeSubscription;
    return {
        publish(payload) {
            publishMessage(messageContext, channel, payload);
        },
        subscribe(callback, options) {
            this.unsubscribe();
            activeSubscription = subscribeToChannel(messageContext, channel, callback, options);
            return activeSubscription;
        },
        unsubscribe() {
            unsubscribeFromChannel(activeSubscription);
            activeSubscription = undefined;
        }
    };
}
