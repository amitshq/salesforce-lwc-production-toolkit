import { createElement } from 'lwc';
import DatatableLookupEditor from 'c/datatableLookupEditor';
import DatatableRichTextEditor from 'c/datatableRichTextEditor';

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function create(tag, Component, props) {
    const element = createElement(tag, { is: Component });
    Object.assign(element, props);
    document.body.appendChild(element);
    await flushPromises();
    return element;
}

describe('inline editors for c-extended-datatable', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    describe('c-datatable-lookup-editor', () => {
        it('passes its settings to the record picker', async () => {
            const element = await create('c-datatable-lookup-editor', DatatableLookupEditor, {
                label: 'Parent',
                objectApiName: 'Account',
                value: '001P'
            });

            const picker = element.shadowRoot.querySelector('lightning-record-picker');
            expect(picker.label).toBe('Parent');
            expect(picker.objectApiName).toBe('Account');
            expect(picker.value).toBe('001P');
            expect(picker.variant).toBe('label-hidden');
        });

        it('reports the picked record as its value, and null once cleared', async () => {
            const element = await create('c-datatable-lookup-editor', DatatableLookupEditor, { objectApiName: 'Account' });
            const onChange = jest.fn();
            element.addEventListener('change', onChange);
            const picker = element.shadowRoot.querySelector('lightning-record-picker');

            picker.dispatchEvent(new CustomEvent('change', { detail: { recordId: '001Q' } }));
            expect(element.value).toBe('001Q');
            picker.dispatchEvent(new CustomEvent('change', { detail: { recordId: null } }));

            expect(element.value).toBeNull();
            expect(onChange.mock.calls.map((call) => call[0].detail.value)).toEqual(['001Q', null]);
        });

        it('behaves like an input for the inline-edit panel', async () => {
            const element = await create('c-datatable-lookup-editor', DatatableLookupEditor, { objectApiName: 'Account' });
            const picker = element.shadowRoot.querySelector('lightning-record-picker');
            picker.reportValidity = jest.fn();
            picker.focus = jest.fn();

            expect(element.validity).toEqual({ valid: true });
            element.showHelpMessageIfInvalid();
            element.focus();

            expect(picker.reportValidity).toHaveBeenCalled();
            expect(picker.focus).toHaveBeenCalled();
        });
    });

    describe('c-datatable-rich-text-editor', () => {
        it('edits the value with the rich-text editor and reports changes', async () => {
            const element = await create('c-datatable-rich-text-editor', DatatableRichTextEditor, { label: 'Notes', value: '<p>Hi</p>' });
            const onChange = jest.fn();
            element.addEventListener('change', onChange);
            const editor = element.shadowRoot.querySelector('lightning-input-rich-text');
            expect(editor.value).toBe('<p>Hi</p>');
            expect(editor.label).toBe('Notes');

            editor.value = '<p>Bye</p>';
            editor.dispatchEvent(new CustomEvent('change'));

            expect(element.value).toBe('<p>Bye</p>');
            expect(onChange.mock.calls[0][0].detail).toEqual({ value: '<p>Bye</p>' });
        });

        it('is always valid and can take focus', async () => {
            const element = await create('c-datatable-rich-text-editor', DatatableRichTextEditor, {});
            const editor = element.shadowRoot.querySelector('lightning-input-rich-text');
            editor.focus = jest.fn();

            expect(element.validity).toEqual({ valid: true });
            expect(() => element.showHelpMessageIfInvalid()).not.toThrow();
            element.focus();

            expect(editor.focus).toHaveBeenCalled();
            expect(element.value).toBe('');
        });
    });
});
