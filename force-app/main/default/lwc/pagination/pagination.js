import { LightningElement, api } from 'lwc';

const MAX_PAGE_BUTTONS_DEFAULT = 5;

/**
 * Standalone Previous/Next + numbered-page control. c-enterprise-datatable
 * has its own built-in pagination bar, but plenty of other lists (a related
 * list clone, a report viewer, a search-results page) need the exact same
 * control without the rest of the datatable attached.
 *
 * Fully controlled: it renders from `currentPage`/`totalRecords`/`pageSize`
 * and only ever asks for a change via events - it never mutates its own
 * paging state.
 *
 * @example
 * <c-pagination
 *     current-page={currentPage}
 *     total-records={totalRecords}
 *     page-size={pageSize}
 *     onpagechange={handlePageChange}
 * ></c-pagination>
 */
export default class Pagination extends LightningElement {
    @api currentPage = 1;
    @api totalRecords = 0;
    @api pageSize = 25;
    @api maxPageButtons = MAX_PAGE_BUTTONS_DEFAULT;

    get totalPages() {
        return Math.max(1, Math.ceil(this.totalRecords / this.pageSize));
    }

    get isFirstPage() {
        return this.currentPage <= 1;
    }

    get isLastPage() {
        return this.currentPage >= this.totalPages;
    }

    get statusLabel() {
        if (this.totalRecords === 0) {
            return 'No records';
        }
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.totalRecords);
        return `${start}–${end} of ${this.totalRecords}`;
    }

    get pageButtons() {
        const total = this.totalPages;
        const max = Math.max(1, this.maxPageButtons);
        let start = Math.max(1, this.currentPage - Math.floor(max / 2));
        let end = Math.min(total, start + max - 1);
        start = Math.max(1, end - max + 1);

        const buttons = [];
        for (let page = start; page <= end; page++) {
            buttons.push({
                page,
                label: String(page),
                variant: page === this.currentPage ? 'brand' : 'neutral'
            });
        }
        return buttons;
    }

    handlePreviousClick() {
        if (!this.isFirstPage) {
            this.notifyPageChange(this.currentPage - 1);
        }
    }

    handleNextClick() {
        if (!this.isLastPage) {
            this.notifyPageChange(this.currentPage + 1);
        }
    }

    handlePageButtonClick(event) {
        const page = Number(event.currentTarget.dataset.page);
        if (page !== this.currentPage) {
            this.notifyPageChange(page);
        }
    }

    notifyPageChange(page) {
        this.dispatchEvent(new CustomEvent('pagechange', { detail: { page } }));
    }
}
