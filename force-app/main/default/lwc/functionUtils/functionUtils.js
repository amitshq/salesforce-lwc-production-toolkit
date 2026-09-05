/**
 * debounce/throttle for LWC event handlers (search-as-you-type, scroll,
 * resize) where every keystroke/tick firing a server call or re-render
 * would be wasteful.
 */

/**
 * Returns a wrapped version of `fn` that only runs after `waitMs` have
 * passed without another call. Later calls reset the timer and replace the
 * arguments used for the eventual invocation.
 * @param {Function} fn
 * @param {number} waitMs
 * @returns {Function & { cancel: Function }}
 */
export function debounce(fn, waitMs = 300) {
    let timeoutId;

    function debounced(...args) {
        clearTimeout(timeoutId);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        timeoutId = setTimeout(() => {
            timeoutId = undefined;
            fn.apply(this, args);
        }, waitMs);
    }

    debounced.cancel = () => {
        clearTimeout(timeoutId);
        timeoutId = undefined;
    };

    return debounced;
}

/**
 * Returns a wrapped version of `fn` that runs at most once every `waitMs`.
 * The first call in a window runs immediately (leading edge); a call that
 * arrives mid-window is deferred to fire once at the end (trailing edge)
 * with the most recent arguments, so no invocation is silently dropped.
 * @param {Function} fn
 * @param {number} waitMs
 * @returns {Function & { cancel: Function }}
 */
export function throttle(fn, waitMs = 300) {
    let lastRunAt = 0;
    let trailingTimeoutId;
    let trailingArgs;

    function invoke(context, args) {
        lastRunAt = Date.now();
        fn.apply(context, args);
    }

    function throttled(...args) {
        const remaining = waitMs - (Date.now() - lastRunAt);
        if (remaining <= 0) {
            clearTimeout(trailingTimeoutId);
            trailingTimeoutId = undefined;
            invoke(this, args);
        } else {
            trailingArgs = args;
            clearTimeout(trailingTimeoutId);
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            trailingTimeoutId = setTimeout(() => {
                trailingTimeoutId = undefined;
                invoke(this, trailingArgs);
            }, remaining);
        }
    }

    throttled.cancel = () => {
        clearTimeout(trailingTimeoutId);
        trailingTimeoutId = undefined;
    };

    return throttled;
}
