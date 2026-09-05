import { createElement } from 'lwc';
import StateManager from 'c/stateManager';

describe('c-state-manager', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('shows the loading slot when isLoading is true, regardless of other flags', () => {
        const element = createElement('c-state-manager', { is: StateManager });
        element.isLoading = true;
        element.hasError = true;
        element.isEmpty = true;
        document.body.appendChild(element);

        expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();
        expect(element.shadowRoot.querySelector('c-error-state')).toBeNull();
    });

    it('shows the error slot when hasError is true and not loading', () => {
        const element = createElement('c-state-manager', { is: StateManager });
        element.hasError = true;
        element.errorMessage = 'Boom';
        document.body.appendChild(element);

        expect(element.shadowRoot.querySelector('c-error-state')).not.toBeNull();
    });

    it('shows the empty slot only when not loading and not errored', () => {
        const element = createElement('c-state-manager', { is: StateManager });
        element.isEmpty = true;
        document.body.appendChild(element);

        expect(element.shadowRoot.querySelector('c-empty-state')).not.toBeNull();
    });

    it('shows the default content slot once data is ready', () => {
        const element = createElement('c-state-manager', { is: StateManager });
        document.body.appendChild(element);

        expect(element.shadowRoot.querySelector('lightning-spinner')).toBeNull();
        expect(element.shadowRoot.querySelector('c-error-state')).toBeNull();
        expect(element.shadowRoot.querySelector('c-empty-state')).toBeNull();
        expect(element.shadowRoot.querySelector('slot:not([name])')).not.toBeNull();
    });
});
