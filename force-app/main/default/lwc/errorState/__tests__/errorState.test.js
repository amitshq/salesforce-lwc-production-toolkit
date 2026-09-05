import { createElement } from 'lwc';
import ErrorState from 'c/errorState';

describe('c-error-state', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('dispatches a retry event when the retry button is clicked', () => {
        const element = createElement('c-error-state', { is: ErrorState });
        document.body.appendChild(element);
        const retryHandler = jest.fn();
        element.addEventListener('retry', retryHandler);

        element.shadowRoot.querySelector('lightning-button').click();

        expect(retryHandler).toHaveBeenCalledTimes(1);
    });

    it('hides the retry button when hideRetry is true', () => {
        const element = createElement('c-error-state', { is: ErrorState });
        element.hideRetry = true;
        document.body.appendChild(element);

        expect(element.shadowRoot.querySelector('lightning-button')).toBeNull();
    });

    it('reveals details only after the toggle is clicked', () => {
        const element = createElement('c-error-state', { is: ErrorState });
        element.details = '{"code":"FIELD_CUSTOM_VALIDATION_EXCEPTION"}';
        document.body.appendChild(element);

        expect(element.shadowRoot.querySelector('pre').className).toContain('slds-hide');

        element.shadowRoot.querySelector('button.slds-button_neutral').click();

        return Promise.resolve().then(() => {
            expect(element.shadowRoot.querySelector('pre').className).not.toContain('slds-hide');
            expect(element.shadowRoot.querySelector('pre').textContent).toBe(element.details);
        });
    });
});
