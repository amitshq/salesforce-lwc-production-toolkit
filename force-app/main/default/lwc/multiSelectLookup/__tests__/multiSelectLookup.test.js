import { createElement } from 'lwc';
import MultiSelectLookup from 'c/multiSelectLookup';
import queryRecords from '@salesforce/apex/GenericQueryService.query';

jest.mock('@salesforce/apex/GenericQueryService.query', () => ({ default: jest.fn() }), { virtual: true });

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createLookup(props = {}) {
    const element = createElement('c-multi-select-lookup', { is: MultiSelectLookup });
    element.objectApiName = 'Contact';
    element.labelField = 'Name';
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-multi-select-lookup', () => {
    afterEach(() => {
        jest.clearAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('does not search below minSearchLength', async () => {
        const element = createLookup();
        const input = element.shadowRoot.querySelector('input');
        input.value = 'a';
        input.dispatchEvent(new CustomEvent('input'));
        await flushPromises();

        expect(queryRecords).not.toHaveBeenCalled();
    });

    it('searches and renders results once the query resolves', async () => {
        queryRecords.mockResolvedValue({ records: [{ Id: '003', Name: 'Amy Taylor' }] });
        // The debounce's setTimeout has to be scheduled under fake timers to be
        // advanceable - starting fake timers after dispatch would leave it
        // running under real timers, un-touched by advanceTimersByTime.
        jest.useFakeTimers();
        const element = createLookup();
        const input = element.shadowRoot.querySelector('input');
        input.value = 'am';
        input.dispatchEvent(new CustomEvent('input'));

        jest.advanceTimersByTime(300);
        jest.useRealTimers();
        await flushPromises();

        expect(queryRecords).toHaveBeenCalledWith(
            expect.objectContaining({ objectApiName: 'Contact', searchTerm: 'am', searchFields: ['Name'] })
        );
        expect(element.shadowRoot.textContent).toContain('Amy Taylor');
    });

    it('selecting a result adds a pill and dispatches change', async () => {
        queryRecords.mockResolvedValue({ records: [{ Id: '003', Name: 'Amy Taylor' }] });
        jest.useFakeTimers();
        const element = createLookup();
        const changeHandler = jest.fn();
        element.addEventListener('change', changeHandler);

        const input = element.shadowRoot.querySelector('input');
        input.value = 'am';
        input.dispatchEvent(new CustomEvent('input'));
        jest.advanceTimersByTime(300);
        jest.useRealTimers();
        await flushPromises();

        element.shadowRoot.querySelector('[data-id="003"]').click();
        await flushPromises();

        expect(changeHandler).toHaveBeenCalledWith(
            expect.objectContaining({ detail: { value: [{ id: '003', label: 'Amy Taylor' }] } })
        );
        expect(element.shadowRoot.querySelector('.slds-pill__label').textContent).toBe('Amy Taylor');
    });

    it('removing a pill dispatches change with it excluded', async () => {
        const element = createLookup({ selectedRecords: [{ id: '003', label: 'Amy Taylor' }] });
        const changeHandler = jest.fn();
        element.addEventListener('change', changeHandler);

        element.shadowRoot.querySelector('[data-id="003"].slds-pill__remove').click();

        expect(changeHandler).toHaveBeenCalledWith(expect.objectContaining({ detail: { value: [] } }));
    });
});
