import { createElement } from 'lwc';
import DynamicFilterPanel from 'c/dynamicFilterPanel';

const FIELDS = [
    { label: 'Industry', value: 'Industry', type: 'text' },
    { label: 'Annual Revenue', value: 'AnnualRevenue', type: 'currency' },
    { label: 'Active', value: 'IsActive__c', type: 'boolean' }
];

function createPanel(props = {}) {
    const element = createElement('c-dynamic-filter-panel', { is: DynamicFilterPanel });
    element.fields = FIELDS;
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-dynamic-filter-panel', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('starts with no rows and an empty value', () => {
        const element = createPanel();
        expect(element.value).toEqual([]);
        expect(element.shadowRoot.querySelectorAll('lightning-combobox')).toHaveLength(0);
    });

    it('adding a condition renders field/operator/value controls defaulted to the first field', () => {
        const element = createPanel();
        element.addCondition();

        return Promise.resolve().then(() => {
            const combos = element.shadowRoot.querySelectorAll('lightning-combobox');
            expect(combos).toHaveLength(2);
            expect(combos[0].value).toBe('Industry');
            expect(combos[1].value).toBe('=');
        });
    });

    it('emits a QueryFilter-shaped change event as fields are filled in', () => {
        const element = createPanel();
        const changeHandler = jest.fn();
        element.addEventListener('change', changeHandler);
        element.addCondition();

        return Promise.resolve().then(() => {
            const valueInput = element.shadowRoot.querySelector('lightning-input');
            valueInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'Technology' } }));

            expect(changeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    detail: { value: [{ fieldName: 'Industry', operatorName: '=', value: 'Technology' }] }
                })
            );
        });
    });

    it('splits a comma-separated value into an array for IN/NOT IN operators', () => {
        const element = createPanel();
        element.addCondition();

        return Promise.resolve().then(() => {
            const [, operatorCombo] = element.shadowRoot.querySelectorAll('lightning-combobox');
            operatorCombo.dispatchEvent(new CustomEvent('change', { detail: { value: 'IN' } }));

            return Promise.resolve().then(() => {
                const valueInput = element.shadowRoot.querySelector('lightning-input');
                valueInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'Tech, Finance' } }));

                expect(element.value).toEqual([{ fieldName: 'Industry', operatorName: 'IN', value: ['Tech', 'Finance'] }]);
            });
        });
    });

    it('an incomplete row (no value yet) is excluded from the emitted value', () => {
        const element = createPanel();
        element.addCondition();
        expect(element.value).toEqual([]);
    });

    it('removing a row drops it from value', () => {
        const element = createPanel();
        element.addCondition();

        return Promise.resolve().then(() => {
            const valueInput = element.shadowRoot.querySelector('lightning-input');
            valueInput.dispatchEvent(new CustomEvent('change', { detail: { value: 'Technology' } }));
            expect(element.value).toHaveLength(1);

            const removeButton = element.shadowRoot.querySelector('lightning-button-icon');
            removeButton.click();
            expect(element.value).toEqual([]);
        });
    });

    it('clearAll() removes every row and notifies with an empty value', () => {
        const element = createPanel();
        const changeHandler = jest.fn();
        element.addEventListener('change', changeHandler);
        element.addCondition();
        element.clearAll();

        expect(element.value).toEqual([]);
        expect(changeHandler).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { value: [] } }));
    });
});
