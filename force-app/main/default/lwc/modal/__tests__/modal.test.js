import { createElement } from 'lwc';
import Modal from 'c/modal';
import ModalTestHost from 'c/modalTestHost';

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

    describe('keyboard focus', () => {
        // open() moves focus once the dialog has rendered, on the next tick.
        function flush() {
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            return new Promise((resolve) => setTimeout(resolve, 0));
        }

        // Content has to be slotted from a real parent template, so these tests go through a
        // small test-only host (force-app/test/jest-fixtures/modalTestHost).
        async function openHost(props = {}) {
            const host = createElement('c-modal-test-host', { is: ModalTestHost });
            Object.assign(host, props);
            document.body.appendChild(host);
            host.open();
            await flush();
            return host;
        }

        const modalOf = (host) => host.shadowRoot.querySelector('c-modal');
        const closeButtonOf = (host) => modalOf(host).shadowRoot.querySelector('button.slds-modal__close');
        const dialogOf = (host) => modalOf(host).shadowRoot.querySelector('section[role="dialog"]');
        const guardOf = (host, which) => modalOf(host).shadowRoot.querySelector(`.focus-guard[data-guard="${which}"]`);
        // The modal's own controls report focus through its shadow root; slotted ones through the host's.
        const focusedInModal = (host) => modalOf(host).shadowRoot.activeElement;
        const focusedInHost = (host) => host.shadowRoot.activeElement;

        it('moves focus to the close button when it opens', async () => {
            const host = await openHost({ withBodyInput: true });

            expect(focusedInModal(host)).toBe(closeButtonOf(host));
        });

        it('without a close button, focuses the first control the parent slotted in', async () => {
            const host = await openHost({ hideCloseButton: true, withBodyInput: true, withFooterButtons: true });

            expect(focusedInHost(host)).toBe(host.shadowRoot.querySelector('.body-input'));
        });

        it('with nothing focusable inside, focuses the dialog itself so keyboard users are still in it', async () => {
            const host = await openHost({ hideCloseButton: true });

            expect(focusedInModal(host)).toBe(dialogOf(host));
        });

        it('Tab past the last control wraps round to the first', async () => {
            const host = await openHost({ withBodyInput: true, withFooterButtons: true });
            host.shadowRoot.querySelector('.save').focus();

            guardOf(host, 'end').focus(); // where Tab lands after the last control

            expect(focusedInModal(host)).toBe(closeButtonOf(host));
        });

        it('Shift+Tab before the first control wraps round to the last slotted footer button', async () => {
            const host = await openHost({ withBodyInput: true, withFooterButtons: true });

            guardOf(host, 'start').focus(); // where Shift+Tab lands before the first control

            expect(focusedInHost(host)).toBe(host.shadowRoot.querySelector('.save'));
        });

        it('wraps to the first slotted control when there is no close button', async () => {
            const host = await openHost({ hideCloseButton: true, withBodyInput: true, withFooterButtons: true });
            host.shadowRoot.querySelector('.save').focus();

            guardOf(host, 'end').focus();

            expect(focusedInHost(host)).toBe(host.shadowRoot.querySelector('.body-input'));
        });

        it('skips disabled controls when wrapping', async () => {
            const host = await openHost({ withDisabledLastButton: true });

            guardOf(host, 'start').focus();

            expect(focusedInHost(host)).toBe(host.shadowRoot.querySelector('.save'));
        });

        it('wraps to base components such as lightning-button, which the old trap could not see', async () => {
            const host = await openHost({ withBaseComponentButton: true });
            const baseButton = host.shadowRoot.querySelector('.base-button');
            baseButton.focus = jest.fn();

            guardOf(host, 'start').focus();

            expect(baseButton.focus).toHaveBeenCalled();
        });

        it('keeps focus in the dialog when wrapping with nothing focusable inside', async () => {
            const host = await openHost({ hideCloseButton: true });

            guardOf(host, 'end').focus();

            expect(focusedInModal(host)).toBe(dialogOf(host));
        });

        it('gives focus back to whatever had it before opening', async () => {
            const opener = document.createElement('button');
            document.body.appendChild(opener);
            opener.focus();
            const host = await openHost({ withBodyInput: true });

            host.close();

            expect(document.activeElement).toBe(opener);
        });

        it('has a close button that cannot submit a surrounding form, named once for screen readers', async () => {
            const host = await openHost();
            const closeButton = closeButtonOf(host);

            expect(closeButton.getAttribute('type')).toBe('button');
            expect(closeButton.querySelector('lightning-icon').alternativeText).toBeFalsy();
            expect(closeButton.querySelector('.slds-assistive-text').textContent).toBe('Close');
        });
    });
});
