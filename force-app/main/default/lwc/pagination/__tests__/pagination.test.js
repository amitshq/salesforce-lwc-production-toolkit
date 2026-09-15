import { createElement } from 'lwc';
import Pagination from 'c/pagination';

function createPagination(props = {}) {
    const element = createElement('c-pagination', { is: Pagination });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-pagination', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('shows the record range for the current page', () => {
        const element = createPagination({ currentPage: 2, pageSize: 25, totalRecords: 60 });
        expect(element.shadowRoot.textContent).toContain('26–50 of 60');
    });

    it('shows "No records" when there is nothing to page through', () => {
        const element = createPagination({ totalRecords: 0 });
        expect(element.shadowRoot.textContent).toContain('No records');
    });

    it('disables Previous on the first page and Next on the last page', () => {
        const element = createPagination({ currentPage: 1, pageSize: 10, totalRecords: 10 });
        const buttons = element.shadowRoot.querySelectorAll('lightning-button');
        expect(buttons[0].disabled).toBe(true); // Previous
        expect(buttons[buttons.length - 1].disabled).toBe(true); // Next (only 1 page)
    });

    it('dispatches pagechange when Next is clicked', () => {
        const element = createPagination({ currentPage: 1, pageSize: 10, totalRecords: 30 });
        const pageChangeHandler = jest.fn();
        element.addEventListener('pagechange', pageChangeHandler);

        const buttons = element.shadowRoot.querySelectorAll('lightning-button');
        buttons[buttons.length - 1].click(); // Next

        expect(pageChangeHandler).toHaveBeenCalledWith(expect.objectContaining({ detail: { page: 2 } }));
    });

    it('clicking a numbered page button dispatches that page number', () => {
        const element = createPagination({ currentPage: 1, pageSize: 10, totalRecords: 50 });
        const pageChangeHandler = jest.fn();
        element.addEventListener('pagechange', pageChangeHandler);

        const thirdPageButton = element.shadowRoot.querySelector('lightning-button[data-page="3"]');
        thirdPageButton.click();

        expect(pageChangeHandler).toHaveBeenCalledWith(expect.objectContaining({ detail: { page: 3 } }));
    });

    it('windows the page buttons around the current page instead of listing every page', () => {
        const element = createPagination({ currentPage: 10, pageSize: 10, totalRecords: 500, maxPageButtons: 5 });
        const pageButtons = Array.from(element.shadowRoot.querySelectorAll('lightning-button[data-page]')).map((b) =>
            Number(b.dataset.page)
        );
        expect(pageButtons).toEqual([8, 9, 10, 11, 12]);
    });
});
