import { LightningElement, api } from 'lwc';

/**
 * Drop-in "load more when scrolled into view" sentinel, built on
 * IntersectionObserver rather than a scroll listener (no manual throttling,
 * no manual distance-from-bottom math). Reusable for any list or grid, not
 * just c-enterprise-datatable's infinite-scroll mode.
 *
 * @example
 * <template for:each={rows} for:item="row"> ... </template>
 * <c-infinite-scroll-loader is-loading={isLoadingMore} disabled={allRowsLoaded} onloadmore={handleLoadMore}>
 * </c-infinite-scroll-loader>
 */
export default class InfiniteScrollLoader extends LightningElement {
    @api isLoading = false;
    @api disabled = false;
    @api rootMargin = '100px';

    observer;

    renderedCallback() {
        if (!this.observer) {
            this.setUpObserver();
        }
    }

    setUpObserver() {
        const sentinel = this.template.querySelector('[data-sentinel]');
        if (!sentinel) {
            return;
        }
        this.observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting && !this.isLoading && !this.disabled) {
                    this.dispatchEvent(new CustomEvent('loadmore'));
                }
            },
            { root: null, rootMargin: this.rootMargin, threshold: 0 }
        );
        this.observer.observe(sentinel);
    }

    disconnectedCallback() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = undefined;
        }
    }
}
