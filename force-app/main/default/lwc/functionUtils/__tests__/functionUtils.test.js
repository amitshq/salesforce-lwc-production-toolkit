import { debounce, throttle } from 'c/functionUtils';

describe('functionUtils', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    describe('debounce', () => {
        it('only invokes once after calls stop arriving', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced('a');
            jest.advanceTimersByTime(50);
            debounced('b');
            jest.advanceTimersByTime(50);
            debounced('c');
            jest.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('c');
        });

        it('cancel() prevents the pending call', () => {
            const fn = jest.fn();
            const debounced = debounce(fn, 100);

            debounced('a');
            debounced.cancel();
            jest.advanceTimersByTime(200);

            expect(fn).not.toHaveBeenCalled();
        });
    });

    describe('throttle', () => {
        it('invokes immediately on the leading edge', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);

            throttled('a');

            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('a');
        });

        it('defers calls made mid-window to a single trailing call', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);

            throttled('a');
            throttled('b');
            throttled('c');

            expect(fn).toHaveBeenCalledTimes(1);

            jest.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledTimes(2);
            expect(fn).toHaveBeenLastCalledWith('c');
        });

        it('allows a new leading call once the window has fully elapsed', () => {
            const fn = jest.fn();
            const throttled = throttle(fn, 100);

            throttled('a');
            jest.advanceTimersByTime(150);
            throttled('b');

            expect(fn).toHaveBeenCalledTimes(2);
            expect(fn).toHaveBeenLastCalledWith('b');
        });
    });
});
