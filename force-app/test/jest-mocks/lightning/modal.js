import { LightningElement, api } from 'lwc';

/**
 * Minimal stand-in for the platform's `lightning/modal` base class, which
 * @salesforce/sfdx-lwc-jest (as of 7.x) does not ship a stub for. Only
 * `close()`/`open()` are needed to unit test a LightningModal subclass's
 * own logic - the real modal chrome/overlay is platform behavior that
 * doesn't run in jsdom anyway.
 *
 * `close()` also dispatches a `__modalclose` event: a subclass's `@api`
 * methods aren't guaranteed to be spy-able from outside through this
 * mock's own compiled bridge the way they would be on the real base class,
 * but a dispatched event always crosses that boundary cleanly, so tests
 * assert on that instead of spying on `close` directly.
 */
export default class LightningModal extends LightningElement {
    static open() {
        return Promise.resolve(undefined);
    }

    @api
    close(result) {
        this.dispatchEvent(new CustomEvent('__modalclose', { detail: result }));
    }
}
