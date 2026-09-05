import { createElement } from 'lwc';
import BulkActionBar from 'c/bulkActionBar';

describe('c-bulk-action-bar', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders nothing when nothing is selected', () => {
        const element = createElement('c-bulk-action-bar', { is: BulkActionBar });
        document.body.appendChild(element);

        expect(element.shadowRoot.textContent).toBe('');
    });

    it('shows the selected count and one button per action', () => {
        const element = createElement('c-bulk-action-bar', { is: BulkActionBar });
        element.selectedCount = 3;
        element.actions = [
            { name: 'edit', label: 'Edit' },
            { name: 'delete', label: 'Delete', variant: 'destructive' }
        ];
        document.body.appendChild(element);

        expect(element.shadowRoot.textContent).toContain('3 selected');
        expect(element.shadowRoot.querySelectorAll('lightning-button')).toHaveLength(2);
    });

    it('dispatches action with the clicked action name', () => {
        const element = createElement('c-bulk-action-bar', { is: BulkActionBar });
        element.selectedCount = 2;
        element.actions = [{ name: 'delete', label: 'Delete' }];
        document.body.appendChild(element);
        const actionHandler = jest.fn();
        element.addEventListener('action', actionHandler);

        element.shadowRoot.querySelector('lightning-button').click();

        expect(actionHandler).toHaveBeenCalledWith(expect.objectContaining({ detail: { name: 'delete', selectedCount: 2 } }));
    });

    it('dispatches clear when the clear button is clicked', () => {
        const element = createElement('c-bulk-action-bar', { is: BulkActionBar });
        element.selectedCount = 1;
        document.body.appendChild(element);
        const clearHandler = jest.fn();
        element.addEventListener('clear', clearHandler);

        element.shadowRoot.querySelector('lightning-button-icon').click();

        expect(clearHandler).toHaveBeenCalledTimes(1);
    });
});
