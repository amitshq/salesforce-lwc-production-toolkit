import { createElement } from 'lwc';
import ConfirmDialog from 'c/confirmDialog';

describe('c-confirm-dialog', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders the provided label and message', () => {
        const element = createElement('c-confirm-dialog', { is: ConfirmDialog });
        element.label = 'Delete Records';
        element.message = 'This cannot be undone.';
        document.body.appendChild(element);

        expect(element.shadowRoot.textContent).toContain('This cannot be undone.');
    });

    it('resolves true when the confirm button is clicked', () => {
        const element = createElement('c-confirm-dialog', { is: ConfirmDialog });
        const closeHandler = jest.fn();
        // The test's `lightning/modal` stub dispatches this event from close()
        // instead of relying on `close` itself being spy-able from outside -
        // see force-app/test/jest-mocks/lightning/modal.js for why.
        element.addEventListener('__modalclose', closeHandler);
        document.body.appendChild(element);

        const buttons = element.shadowRoot.querySelectorAll('lightning-button');
        buttons[1].dispatchEvent(new CustomEvent('click'));

        expect(closeHandler).toHaveBeenCalledWith(expect.objectContaining({ detail: true }));
    });

    it('resolves false when the cancel button is clicked', () => {
        const element = createElement('c-confirm-dialog', { is: ConfirmDialog });
        const closeHandler = jest.fn();
        element.addEventListener('__modalclose', closeHandler);
        document.body.appendChild(element);

        const buttons = element.shadowRoot.querySelectorAll('lightning-button');
        buttons[0].dispatchEvent(new CustomEvent('click'));

        expect(closeHandler).toHaveBeenCalledWith(expect.objectContaining({ detail: false }));
    });

    it('uses the destructive button variant when variant is destructive', () => {
        const element = createElement('c-confirm-dialog', { is: ConfirmDialog });
        element.variant = 'destructive';
        document.body.appendChild(element);

        const confirmButton = element.shadowRoot.querySelectorAll('lightning-button')[1];
        expect(confirmButton.variant).toBe('destructive');
    });
});
