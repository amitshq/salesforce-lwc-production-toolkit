import { createElement } from 'lwc';
import ColumnChooser from 'c/columnChooser';

const COLUMNS = [
    { fieldName: 'Name', label: 'Account Name' },
    { fieldName: 'Industry', label: 'Industry' },
    { fieldName: 'Phone', label: 'Phone' }
];

function createChooser(props = {}) {
    const element = createElement('c-column-chooser', { is: ColumnChooser });
    Object.assign(element, { columns: COLUMNS, ...props });
    document.body.appendChild(element);
    return element;
}

function checkboxes(element) {
    return Array.from(element.shadowRoot.querySelectorAll('lightning-input'));
}

function toggle(checkbox, checked) {
    checkbox.checked = checked;
    checkbox.dispatchEvent(new CustomEvent('change'));
}

function showAllButton(element) {
    return element.shadowRoot.querySelector('lightning-button');
}

describe('c-column-chooser', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('lists every column, all checked when no selection is given', () => {
        const element = createChooser();

        expect(checkboxes(element).map((c) => [c.label, c.checked])).toEqual([
            ['Account Name', true],
            ['Industry', true],
            ['Phone', true]
        ]);
        expect(showAllButton(element).disabled).toBe(true);
    });

    it('checks only the visible fields', () => {
        const element = createChooser({ visibleFields: ['Name', 'Phone'] });

        expect(checkboxes(element).map((c) => c.checked)).toEqual([true, false, true]);
        expect(showAllButton(element).disabled).toBe(false);
    });

    it('ignores visible fields that are not columns', () => {
        const element = createChooser({ visibleFields: ['Name', 'Gone__c'] });

        expect(checkboxes(element).map((c) => c.checked)).toEqual([true, false, false]);
    });

    it('reports the new selection in column order when a box is unchecked', () => {
        const element = createChooser();
        const handler = jest.fn();
        element.addEventListener('change', handler);

        toggle(checkboxes(element)[1], false);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail.visibleFields).toEqual(['Name', 'Phone']);
    });

    it('keeps column order when a box is checked again', () => {
        const element = createChooser({ visibleFields: ['Phone'] });
        const handler = jest.fn();
        element.addEventListener('change', handler);

        toggle(checkboxes(element)[0], true);

        expect(handler.mock.calls[0][0].detail.visibleFields).toEqual(['Name', 'Phone']);
    });

    it('refuses to hide the last visible column and puts the box back', () => {
        const element = createChooser({ visibleFields: ['Industry'] });
        const handler = jest.fn();
        element.addEventListener('change', handler);
        const only = checkboxes(element)[1];

        toggle(only, false);

        expect(handler).not.toHaveBeenCalled();
        expect(only.checked).toBe(true);
    });

    it('"Show all" reports every column', () => {
        const element = createChooser({ visibleFields: ['Name'] });
        const handler = jest.fn();
        element.addEventListener('change', handler);

        showAllButton(element).click();

        expect(handler.mock.calls[0][0].detail.visibleFields).toEqual(['Name', 'Industry', 'Phone']);
    });

    it('skips columns without a field name, such as action columns', () => {
        const element = createChooser({ columns: [...COLUMNS, { type: 'action', typeAttributes: {} }] });

        expect(checkboxes(element)).toHaveLength(3);
    });
});
