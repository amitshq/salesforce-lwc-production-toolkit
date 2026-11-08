import { createElement } from 'lwc';
import DatatableLookupCell from 'c/datatableLookupCell';
import { getRecord } from 'lightning/uiRecordApi';

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function createCell(props) {
    const element = createElement('c-datatable-lookup-cell', { is: DatatableLookupCell });
    Object.assign(element, { objectApiName: 'Account', urlTemplate: '/lightning/r/{recordId}/view', ...props });
    document.body.appendChild(element);
    await flushPromises();
    return element;
}

describe('c-datatable-lookup-cell', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('shows the loaded name as a link to the related record, without asking for it again', async () => {
        const element = await createCell({ value: '001P', originalValue: '001P', displayValue: 'Parent Co' });

        const link = element.shadowRoot.querySelector('a');
        expect(link.textContent).toBe('Parent Co');
        expect(link.getAttribute('href')).toBe('/lightning/r/001P/view');
        expect(getRecord.getLastConfig().recordId).toBeUndefined();
    });

    it('reads the name of a newly picked record, showing its Id until it arrives', async () => {
        const element = await createCell({ value: '001Q', originalValue: '001P', displayValue: 'Parent Co' });

        expect(getRecord.getLastConfig()).toEqual({ recordId: '001Q', optionalFields: ['Account.Name'] });
        expect(element.shadowRoot.querySelector('a').textContent).toBe('001Q');

        getRecord.emit({ apiName: 'Account', fields: { Name: { value: 'New Parent' } } });
        await flushPromises();
        expect(element.shadowRoot.querySelector('a').textContent).toBe('New Parent');
    });

    it('reads the name when none was loaded, from a custom name field', async () => {
        await createCell({ objectApiName: 'Case', nameField: 'CaseNumber', value: '500A', originalValue: '500A' });

        expect(getRecord.getLastConfig()).toEqual({ recordId: '500A', optionalFields: ['Case.CaseNumber'] });
    });

    it('keeps showing the Id when the record cannot be read', async () => {
        const element = await createCell({ value: '001Q', originalValue: '001P' });
        getRecord.error();
        await flushPromises();

        expect(element.shadowRoot.querySelector('a').textContent).toBe('001Q');
    });

    it('is plain text without a URL pattern, and empty without a value', async () => {
        const unlinked = await createCell({ urlTemplate: undefined, value: '001P', originalValue: '001P', displayValue: 'Parent Co' });
        const empty = await createCell({ value: null });

        expect(unlinked.shadowRoot.querySelector('a')).toBeNull();
        expect(unlinked.shadowRoot.querySelector('span').textContent).toBe('Parent Co');
        expect(empty.shadowRoot.textContent).toBe('');
    });
});
