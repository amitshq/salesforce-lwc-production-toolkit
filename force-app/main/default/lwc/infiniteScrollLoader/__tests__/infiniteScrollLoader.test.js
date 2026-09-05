import { createElement } from 'lwc';
import InfiniteScrollLoader from 'c/infiniteScrollLoader';

class FakeIntersectionObserver {
    constructor(callback) {
        this.callback = callback;
        FakeIntersectionObserver.instances.push(this);
    }
    observe(target) {
        this.target = target;
    }
    disconnect() {
        this.disconnected = true;
    }
    simulateIntersecting(isIntersecting) {
        this.callback([{ isIntersecting, target: this.target }]);
    }
}
FakeIntersectionObserver.instances = [];

describe('c-infinite-scroll-loader', () => {
    let originalIntersectionObserver;

    beforeEach(() => {
        FakeIntersectionObserver.instances = [];
        originalIntersectionObserver = window.IntersectionObserver;
        window.IntersectionObserver = FakeIntersectionObserver;
    });

    afterEach(() => {
        window.IntersectionObserver = originalIntersectionObserver;
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('dispatches loadmore when the sentinel intersects', () => {
        const element = createElement('c-infinite-scroll-loader', { is: InfiniteScrollLoader });
        document.body.appendChild(element);
        const loadMoreHandler = jest.fn();
        element.addEventListener('loadmore', loadMoreHandler);

        FakeIntersectionObserver.instances[0].simulateIntersecting(true);

        expect(loadMoreHandler).toHaveBeenCalledTimes(1);
    });

    it('does not dispatch loadmore while already loading', () => {
        const element = createElement('c-infinite-scroll-loader', { is: InfiniteScrollLoader });
        element.isLoading = true;
        document.body.appendChild(element);
        const loadMoreHandler = jest.fn();
        element.addEventListener('loadmore', loadMoreHandler);

        FakeIntersectionObserver.instances[0].simulateIntersecting(true);

        expect(loadMoreHandler).not.toHaveBeenCalled();
    });

    it('does not dispatch loadmore when disabled (e.g. no more pages)', () => {
        const element = createElement('c-infinite-scroll-loader', { is: InfiniteScrollLoader });
        element.disabled = true;
        document.body.appendChild(element);
        const loadMoreHandler = jest.fn();
        element.addEventListener('loadmore', loadMoreHandler);

        FakeIntersectionObserver.instances[0].simulateIntersecting(true);

        expect(loadMoreHandler).not.toHaveBeenCalled();
    });

    it('disconnects the observer when removed from the DOM', () => {
        const element = createElement('c-infinite-scroll-loader', { is: InfiniteScrollLoader });
        document.body.appendChild(element);
        const observerInstance = FakeIntersectionObserver.instances[0];

        document.body.removeChild(element);

        expect(observerInstance.disconnected).toBe(true);
    });
});
