import { createElement } from 'lwc';
import Modal from 'c/modal';

describe('c-modal', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders nothing until open() is called', () => {
        const element = createElement('c-modal', { is: Modal });
        document.body.appendChild(element);

        expect(element.shadowRoot.querySelector('section[role="dialog"]')).toBeNull();
    });

    it('open() renders the dialog with the header label', () => {
        const element = createElement('c-modal', { is: Modal });
        element.headerLabel = 'Edit Contact';
        document.body.appendChild(element);

        element.open();

        return Promise.resolve().then(() => {
            const dialog = element.shadowRoot.querySelector('section[role="dialog"]');
            expect(dialog).not.toBeNull();
            expect(element.shadowRoot.textContent).toContain('Edit Contact');
        });
    });

    it('close() removes the dialog and dispatches a close event', () => {
        const element = createElement('c-modal', { is: Modal });
        document.body.appendChild(element);
        const closeHandler = jest.fn();
        element.addEventListener('close', closeHandler);

        element.open();

        return Promise.resolve()
            .then(() => {
                element.close();
                return Promise.resolve();
            })
            .then(() => {
                expect(element.shadowRoot.querySelector('section[role="dialog"]')).toBeNull();
                expect(closeHandler).toHaveBeenCalledTimes(1);
            });
    });

    it('clicking the backdrop closes the modal by default', () => {
        const element = createElement('c-modal', { is: Modal });
        document.body.appendChild(element);
        element.open();

        return Promise.resolve().then(() => {
            element.shadowRoot.querySelector('.slds-backdrop').click();
            return Promise.resolve().then(() => {
                expect(element.shadowRoot.querySelector('section[role="dialog"]')).toBeNull();
            });
        });
    });

    it('preventCloseOnBackdropClick keeps the modal open on backdrop click', () => {
        const element = createElement('c-modal', { is: Modal });
        element.preventCloseOnBackdropClick = true;
        document.body.appendChild(element);
        element.open();

        return Promise.resolve().then(() => {
            element.shadowRoot.querySelector('.slds-backdrop').click();
            return Promise.resolve().then(() => {
                expect(element.shadowRoot.querySelector('section[role="dialog"]')).not.toBeNull();
            });
        });
    });

    it('pressing Escape closes the modal', () => {
        const element = createElement('c-modal', { is: Modal });
        document.body.appendChild(element);
        element.open();

        return Promise.resolve().then(() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            return Promise.resolve().then(() => {
                expect(element.shadowRoot.querySelector('section[role="dialog"]')).toBeNull();
            });
        });
    });

    it('the close button closes the modal', () => {
        const element = createElement('c-modal', { is: Modal });
        document.body.appendChild(element);
        element.open();

        return Promise.resolve().then(() => {
            element.shadowRoot.querySelector('button.slds-modal__close').click();
            return Promise.resolve().then(() => {
                expect(element.shadowRoot.querySelector('section[role="dialog"]')).toBeNull();
            });
        });
    });

    it('hideCloseButton hides the close button', () => {
        const element = createElement('c-modal', { is: Modal });
        element.hideCloseButton = true;
        document.body.appendChild(element);
        element.open();

        return Promise.resolve().then(() => {
            expect(element.shadowRoot.querySelector('button.slds-modal__close')).toBeNull();
        });
    });
});
