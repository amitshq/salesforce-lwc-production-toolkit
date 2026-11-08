import { LightningElement, api } from 'lwc';

/**
 * Test-only parent for c-modal. Content slotted from a real parent template is the only kind
 * the synthetic shadow DOM treats as slotted, so the modal's focus handling has to be tested
 * through a component like this, not by appending children to the modal in the test.
 * Not deployed: force-app/test/** is in .forceignore.
 */
export default class ModalTestHost extends LightningElement {
    @api hideCloseButton = false;
    @api withBodyInput = false;
    @api withFooterButtons = false;
    @api withDisabledLastButton = false;
    @api withBaseComponentButton = false;

    @api
    open() {
        this.template.querySelector('c-modal').open();
    }

    @api
    close() {
        this.template.querySelector('c-modal').close();
    }
}
