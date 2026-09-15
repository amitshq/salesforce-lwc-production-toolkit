import { createElement } from 'lwc';
import DynamicForm from 'c/dynamicForm';
import { getFieldAccess } from 'c/permissionUtils';

jest.mock('c/permissionUtils', () => ({
    getFieldAccess: jest.fn(() => Promise.resolve([]))
}));

const FIELDS = [
    { apiName: 'LastName', label: 'Last Name', type: 'text', required: true },
    { apiName: 'Email', label: 'Email', type: 'email' },
    { apiName: 'IsVip__c', label: 'VIP', type: 'checkbox' }
];

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function stubValidityToPass(element) {
    element.shadowRoot.querySelectorAll('lightning-input, lightning-combobox, lightning-textarea').forEach((input) => {
        input.reportValidity = jest.fn(() => true);
    });
}

function getSubmitButton(element) {
    // `variant` is a JS property (not a reflected HTML attribute) on lightning-button.
    return Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find((b) => b.variant === 'brand');
}

function createForm(props = {}) {
    const element = createElement('c-dynamic-form', { is: DynamicForm });
    element.fields = FIELDS;
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-dynamic-form', () => {
    afterEach(() => {
        jest.clearAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders one input per field, with checkboxes handled separately from text inputs', () => {
        const element = createForm();
        expect(element.shadowRoot.querySelectorAll('lightning-input')).toHaveLength(3);
    });

    it('tracks field edits in getValues()', () => {
        const element = createForm();
        const [lastNameInput] = element.shadowRoot.querySelectorAll('lightning-input');
        lastNameInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'Smith' } }));

        expect(element.getValues()).toEqual({ LastName: 'Smith' });
    });

    it('reads the checked property (not value) for checkbox fields', () => {
        const element = createForm();
        const checkboxInput = Array.from(element.shadowRoot.querySelectorAll('lightning-input')).find(
            (i) => i.type === 'checkbox'
        );
        checkboxInput.dispatchEvent(new CustomEvent('change', { detail: { checked: true } }));

        expect(element.getValues()).toEqual({ IsVip__c: true });
    });

    it('does not dispatch submit when validation fails', () => {
        const element = createForm();
        const submitHandler = jest.fn();
        element.addEventListener('submit', submitHandler);
        // Stubs default reportValidity() to return undefined (falsy) - simulates an invalid required field.
        getSubmitButton(element).click();

        expect(submitHandler).not.toHaveBeenCalled();
    });

    it('dispatches submit with the collected values once validation passes', () => {
        const element = createForm();
        stubValidityToPass(element);
        const submitHandler = jest.fn();
        element.addEventListener('submit', submitHandler);

        const [lastNameInput] = element.shadowRoot.querySelectorAll('lightning-input');
        lastNameInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'Smith' } }));
        getSubmitButton(element).click();

        expect(submitHandler).toHaveBeenCalledWith(expect.objectContaining({ detail: { values: { LastName: 'Smith' } } }));
    });

    it('dispatches cancel when the cancel button is clicked', () => {
        const element = createForm();
        const cancelHandler = jest.fn();
        element.addEventListener('cancel', cancelHandler);

        const buttons = element.shadowRoot.querySelectorAll('lightning-button');
        const cancelButton = Array.from(buttons).find((b) => b.label === 'Cancel');
        cancelButton.click();

        expect(cancelHandler).toHaveBeenCalledTimes(1);
    });

    it('disables a field the user cannot edit, per permissionUtils', async () => {
        getFieldAccess.mockResolvedValueOnce([{ fieldName: 'LastName', readable: true, editable: false }]);
        const element = createForm({ objectApiName: 'Contact' });
        await flushPromises();

        return Promise.resolve().then(() => {
            const [lastNameInput] = element.shadowRoot.querySelectorAll('lightning-input');
            expect(lastNameInput.disabled).toBe(true);
        });
    });

    it('reset() clears tracked values', () => {
        const element = createForm();
        const [lastNameInput] = element.shadowRoot.querySelectorAll('lightning-input');
        lastNameInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'Smith' } }));
        expect(element.getValues()).toEqual({ LastName: 'Smith' });

        element.reset();
        expect(element.getValues()).toEqual({});
    });
});
