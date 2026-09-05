import { LightningElement, api } from 'lwc';

/**
 * Multi-step flow: a `lightning-progress-indicator` for the visual stepper,
 * plus a single default slot whose direct children the wizard shows/hides
 * by step (matched via each child's `data-step` attribute) - so form state
 * in a step you've stepped away from isn't lost. (LWC's `<slot>` name can't
 * be a dynamic expression, so one named slot per step isn't an option here;
 * toggling the `hidden` attribute on slotted light-DOM children is the
 * standard way around that.)
 *
 * Per-step validation is done with the cancelable `beforestepchange` event
 * rather than the wizard reaching into a child form's internals: a
 * listener can call `event.preventDefault()` to block advancing.
 *
 * @example
 * <c-wizard steps={steps} onbeforestepchange={handleBeforeStepChange} onfinish={handleFinish}>
 *     <div data-step="details">... step 1 fields ...</div>
 *     <div data-step="review">... step 2 summary ...</div>
 * </c-wizard>
 *
 * // steps = [{ label: 'Details', value: 'details' }, { label: 'Review', value: 'review' }]
 */
export default class Wizard extends LightningElement {
    @api steps = [];
    @api indicatorType = 'path'; // 'path' | 'base'
    @api hideIndicator = false;
    @api hideNavigation = false;
    @api backLabel = 'Back';
    @api nextLabel = 'Next';
    @api finishLabel = 'Finish';

    currentIndex = 0;

    get currentStep() {
        return this.steps[this.currentIndex];
    }

    get currentStepValue() {
        return this.currentStep ? this.currentStep.value : undefined;
    }

    get isFirstStep() {
        return this.currentIndex === 0;
    }

    get isLastStep() {
        return this.currentIndex === this.steps.length - 1;
    }

    renderedCallback() {
        this.syncSlottedStepVisibility();
    }

    handleSlotChange() {
        this.syncSlottedStepVisibility();
    }

    syncSlottedStepVisibility() {
        const slot = this.template.querySelector('slot');
        if (!slot) {
            return;
        }
        slot.assignedElements().forEach((element) => {
            const stepValue = element.dataset && element.dataset.step;
            if (stepValue === undefined) {
                return;
            }
            element.hidden = stepValue !== this.currentStepValue;
        });
    }

    /** @returns {boolean} whether the step actually changed */
    @api
    next() {
        return this.goToIndex(this.currentIndex + 1);
    }

    /** @returns {boolean} whether the step actually changed */
    @api
    back() {
        return this.goToIndex(this.currentIndex - 1);
    }

    /** @returns {boolean} whether the step actually changed */
    @api
    goToStep(value) {
        const index = this.steps.findIndex((step) => step.value === value);
        return index >= 0 ? this.goToIndex(index) : false;
    }

    @api
    get activeStep() {
        return this.currentStep;
    }

    goToIndex(index) {
        if (index < 0 || index >= this.steps.length || index === this.currentIndex) {
            return false;
        }
        const fromValue = this.currentStep?.value;
        const toValue = this.steps[index].value;
        const beforeChangeEvent = new CustomEvent('beforestepchange', {
            detail: { fromValue, toValue },
            cancelable: true
        });
        this.dispatchEvent(beforeChangeEvent);
        if (beforeChangeEvent.defaultPrevented) {
            return false;
        }
        this.currentIndex = index;
        this.dispatchEvent(new CustomEvent('stepchange', { detail: { value: toValue, index } }));
        return true;
    }

    handleIndicatorStepClick(event) {
        this.goToStep(event.detail.value);
    }

    handleBackClick() {
        this.back();
    }

    handleNextClick() {
        this.next();
    }

    handleFinishClick() {
        this.dispatchEvent(new CustomEvent('finish', { detail: { value: this.currentStep?.value } }));
    }
}
