import { createElement } from 'lwc';
import MassUpdateDialog from 'c/massUpdateDialog';

const FIELDS = [
    { fieldName: 'Name', label: 'Account Name', type: 'text' },
    { fieldName: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency' },
    { fieldName: 'Industry', label: 'Industry', type: 'picklist', options: [{ label: '--None--', value: '' }, { label: 'Banking', value: 'Banking' }] },
    { fieldName: 'IsActive__c', label: 'Active', type: 'boolean' },
    { fieldName: 'ParentId', label: 'Parent', type: 'lookup', objectApiName: 'Account' },
    { fieldName: 'Notes__c', label: 'Notes', type: 'richText' }
];

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function createDialog(props = {}) {
    const element = createElement('c-mass-update-dialog', { is: MassUpdateDialog });
    Object.assign(element, { recordCount: 3, fields: FIELDS, ...props });
    const closed = jest.fn();
    element.addEventListener('__modalclose', (event) => closed(event.detail));
    document.body.appendChild(element);
    await flushPromises();
    return { element, closed };
}

async function chooseField(element, fieldName) {
    element.shadowRoot.querySelector('.field-input').dispatchEvent(new CustomEvent('change', { detail: { value: fieldName } }));
    await flushPromises();
}

async function typeValue(element, value) {
    element.shadowRoot.querySelector('.value-input').dispatchEvent(new CustomEvent('change', { detail: { value } }));
    await flushPromises();
}

function apply(element) {
    element.shadowRoot.querySelector('.apply-button').click();
}

describe('c-mass-update-dialog', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('starts on the first field and offers every field', async () => {
        const { element } = await createDialog();

        const fieldInput = element.shadowRoot.querySelector('.field-input');
        expect(fieldInput.value).toBe('Name');
        expect(fieldInput.options.map((option) => option.value)).toEqual(FIELDS.map((field) => field.fieldName));
    });

    it('sets a text value', async () => {
        const { element, closed } = await createDialog();
        await typeValue(element, 'Acme');

        expect(element.shadowRoot.querySelector('.summary').textContent).toBe('Account Name will be set to this value on 3 records.');
        expect(element.shadowRoot.querySelector('.apply-button').label).toBe('Update 3 records');
        apply(element);

        expect(closed).toHaveBeenCalledWith({ fieldName: 'Name', value: 'Acme' });
    });

    it('says plainly that an empty value clears the field', async () => {
        const { element, closed } = await createDialog({ recordCount: 1 });

        const applyButton = element.shadowRoot.querySelector('.apply-button');
        expect(applyButton.label).toBe('Clear on 1 record');
        expect(applyButton.variant).toBe('destructive');
        expect(element.shadowRoot.querySelector('.summary').textContent).toContain('will be cleared on 1 record');
        apply(element);

        expect(closed).toHaveBeenCalledWith({ fieldName: 'Name', value: null });
    });

    it('sends a number for a currency field', async () => {
        const { element, closed } = await createDialog();
        await chooseField(element, 'AnnualRevenue');

        const input = element.shadowRoot.querySelector('.value-input');
        expect(input.type).toBe('number');
        expect(input.formatter).toBe('currency');
        await typeValue(element, '1500.5');
        apply(element);

        expect(closed).toHaveBeenCalledWith({ fieldName: 'AnnualRevenue', value: 1500.5 });
    });

    it('offers the picklist values, without the empty choice', async () => {
        const { element, closed } = await createDialog();
        await chooseField(element, 'Industry');

        const input = element.shadowRoot.querySelector('.value-input');
        expect(input.options).toEqual([{ label: 'Banking', value: 'Banking' }]);
        await typeValue(element, 'Banking');
        apply(element);

        expect(closed).toHaveBeenCalledWith({ fieldName: 'Industry', value: 'Banking' });
    });

    it('sets a checkbox to true or false, never clears it', async () => {
        const { element, closed } = await createDialog();
        await chooseField(element, 'IsActive__c');

        expect(element.shadowRoot.querySelector('.apply-button').label).toBe('Update 3 records');
        apply(element);

        expect(closed).toHaveBeenCalledWith({ fieldName: 'IsActive__c', value: false });
    });

    it('picks a lookup with a record picker for its object', async () => {
        const { element, closed } = await createDialog();
        await chooseField(element, 'ParentId');

        const picker = element.shadowRoot.querySelector('lightning-record-picker');
        expect(picker.objectApiName).toBe('Account');
        picker.dispatchEvent(new CustomEvent('change', { detail: { recordId: '001P' } }));
        await flushPromises();
        apply(element);

        expect(closed).toHaveBeenCalledWith({ fieldName: 'ParentId', value: '001P' });
    });

    it('edits rich text with the rich-text editor', async () => {
        const { element } = await createDialog();
        await chooseField(element, 'Notes__c');

        expect(element.shadowRoot.querySelector('lightning-input-rich-text')).not.toBeNull();
    });

    it('starts again with an empty value when the field changes', async () => {
        const { element, closed } = await createDialog();
        await typeValue(element, 'Acme');
        await chooseField(element, 'AnnualRevenue');
        apply(element);

        expect(closed).toHaveBeenCalledWith({ fieldName: 'AnnualRevenue', value: null });
    });

    it('does not apply a value the input reports as invalid', async () => {
        const { element, closed } = await createDialog();
        element.shadowRoot.querySelector('.value-input').reportValidity = () => false;
        apply(element);

        expect(closed).not.toHaveBeenCalled();
    });

    it('closes with nothing when cancelled', async () => {
        const { element, closed } = await createDialog();
        element.shadowRoot.querySelector('.cancel-button').click();

        // The mock reports close(undefined) through a CustomEvent, whose detail reads back as null.
        expect(closed).toHaveBeenCalledTimes(1);
        expect(closed.mock.calls[0][0]).toBeFalsy();
    });

    it('cannot apply without any field to choose', async () => {
        const { element } = await createDialog({ fields: [] });

        expect(element.shadowRoot.querySelector('.apply-button').disabled).toBe(true);
    });
});
