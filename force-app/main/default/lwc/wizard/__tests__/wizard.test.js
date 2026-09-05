import { createElement } from 'lwc';
import Wizard from 'c/wizard';

const STEPS = [
    { label: 'Details', value: 'details' },
    { label: 'Review', value: 'review' },
    { label: 'Confirm', value: 'confirm' }
];

function createWizard() {
    const element = createElement('c-wizard', { is: Wizard });
    element.steps = STEPS;
    const panels = STEPS.map((step) => {
        const panel = document.createElement('div');
        panel.dataset.step = step.value;
        panel.textContent = step.label;
        element.appendChild(panel);
        return panel;
    });
    document.body.appendChild(element);
    return { element, panels };
}

describe('c-wizard', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('starts on the first step', () => {
        const { element } = createWizard();
        expect(element.activeStep.value).toBe('details');
    });

    it('next() advances to the following step and dispatches stepchange', () => {
        const { element } = createWizard();
        const stepChangeHandler = jest.fn();
        element.addEventListener('stepchange', stepChangeHandler);

        const advanced = element.next();

        expect(advanced).toBe(true);
        expect(element.activeStep.value).toBe('review');
        expect(stepChangeHandler).toHaveBeenCalledWith(expect.objectContaining({ detail: { value: 'review', index: 1 } }));
    });

    it('back() does nothing on the first step', () => {
        const { element } = createWizard();
        expect(element.back()).toBe(false);
        expect(element.activeStep.value).toBe('details');
    });

    it('a beforestepchange listener can cancel the transition', () => {
        const { element } = createWizard();
        element.addEventListener('beforestepchange', (event) => event.preventDefault());

        const advanced = element.next();

        expect(advanced).toBe(false);
        expect(element.activeStep.value).toBe('details');
    });

    it('goToStep jumps directly to a named step', () => {
        const { element } = createWizard();
        expect(element.goToStep('confirm')).toBe(true);
        expect(element.activeStep.value).toBe('confirm');
    });

    it('dispatches finish when the Finish button is clicked on the last step', () => {
        const { element } = createWizard();
        element.goToStep('confirm');
        const finishHandler = jest.fn();
        element.addEventListener('finish', finishHandler);

        return Promise.resolve().then(() => {
            // `variant` is a JS property (not a reflected HTML attribute) on
            // lightning-button, so it's matched via the property, not a CSS
            // attribute selector.
            const finishButton = Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find(
                (button) => button.variant === 'success'
            );
            finishButton.click();
            expect(finishHandler).toHaveBeenCalledTimes(1);
        });
    });

    // jsdom's <slot> distribution doesn't reliably expose assignedElements()
    // for light-DOM children appended imperatively (a known jsdom/test-only
    // limitation, not a real-browser one), so the visibility-sync logic
    // itself is exercised directly by stubbing the slot's assignedElements()
    // to return the real panel nodes and forcing a re-render.
    it('hides the previous step and reveals the new one after a step change', () => {
        const { element, panels } = createWizard();

        return Promise.resolve().then(() => {
            const slot = element.shadowRoot.querySelector('slot');
            slot.assignedElements = () => panels;

            element.next(); // triggers a re-render, which re-runs the visibility sync

            return Promise.resolve().then(() => {
                const detailsPanel = panels.find((panel) => panel.dataset.step === 'details');
                const reviewPanel = panels.find((panel) => panel.dataset.step === 'review');
                expect(detailsPanel.hidden).toBe(true);
                expect(reviewPanel.hidden).toBe(false);
            });
        });
    });
});
