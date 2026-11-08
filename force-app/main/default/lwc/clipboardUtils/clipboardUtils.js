/**
 * Copy text to the clipboard from LWC code. It uses the asynchronous Clipboard
 * API where the browser allows it and falls back to a temporary <textarea> and
 * `document.execCommand('copy')` where it does not (an insecure origin, an
 * iframe whose policy blocks the API, an older browser, or a rejected write).
 *
 * Call these straight from a click handler. Browsers only allow a copy while
 * the click's "user activation" is live, and some (Safari) drop it after an
 * `await`, so do the copy first and everything else after it. When the
 * Clipboard API is absent the fallback runs synchronously in the same call.
 *
 * @example
 * import { copyValue } from 'c/clipboardUtils';
 *
 * async handleCopyId() {
 *     const copied = await copyValue(this.recordId);
 *     if (!copied) {
 *         // both routes failed: tell the user, or let them select the text
 *     }
 * }
 */

// Everything that could make the temporary textarea visible, move the page or
// pull the layout around. The 16px font stops iOS Safari zooming in when the
// field takes focus.
const HIDDEN_FIELD_STYLE = {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '1px',
    height: '1px',
    margin: '0',
    padding: '0',
    border: 'none',
    outline: 'none',
    boxShadow: 'none',
    background: 'transparent',
    opacity: '0',
    pointerEvents: 'none',
    fontSize: '16px'
};

/** The element that really has focus, looking through shadow roots (document.activeElement stops at the host). */
function getDeepActiveElement() {
    let active = document.activeElement;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
        active = active.shadowRoot.activeElement;
    }
    return active;
}

function restoreFocus(element) {
    if (element && element !== document.body && typeof element.focus === 'function') {
        try {
            element.focus({ preventScroll: true });
        } catch (error) {
            // The element may have been removed while we were copying; losing focus is the lesser problem.
        }
    }
}

/**
 * What would be copied for a value: `null` and `undefined` become an empty
 * string, an array becomes one item per line (blank items dropped), anything
 * else goes through `String()`. Whitespace around each item is trimmed unless
 * `trim` is false. An empty result means there is nothing worth copying.
 *
 * @param {*} value
 * @param {{ trim?: boolean, separator?: string }} [options]
 * @returns {string}
 */
export function toClipboardText(value, { trim = true, separator = '\n' } = {}) {
    if (value === null || value === undefined) {
        return '';
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => toClipboardText(item, { trim, separator }))
            .filter((item) => item !== '')
            .join(separator);
    }
    const text = String(value);
    return trim ? text.trim() : text;
}

/**
 * Copies text with a temporary, invisible textarea. Runs synchronously and
 * returns whether the browser accepted the copy. Whatever had focus before gets
 * it back, the textarea is always removed again, and empty text is refused
 * without touching the page.
 *
 * `container` is where the textarea is placed (default `document.body`). Pass an
 * element inside the caller's own DOM, such as a `lwc:dom="manual"` div, when the
 * copy happens inside a modal or other focus trap.
 *
 * @param {string} text
 * @param {{ container?: Element }} [options]
 * @returns {boolean}
 */
export function copyTextFallback(text, { container } = {}) {
    const value = text === null || text === undefined ? '' : String(text);
    if (value === '') {
        return false;
    }

    const host = container || document.body;
    const previouslyFocused = getDeepActiveElement();
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.tabIndex = -1;
    Object.assign(textarea.style, HIDDEN_FIELD_STYLE);

    let copied = false;
    host.appendChild(textarea);
    try {
        textarea.focus({ preventScroll: true });
        textarea.select();
        textarea.setSelectionRange(0, value.length);
        copied = document.execCommand('copy') === true;
    } catch (error) {
        // execCommand can throw, or be missing, where copying is blocked.
        copied = false;
    } finally {
        host.removeChild(textarea);
        restoreFocus(previouslyFocused);
    }
    return copied;
}

/**
 * Copies text to the clipboard. Tries `navigator.clipboard.writeText` first and
 * `copyTextFallback` when the API is missing or rejects. Resolves to `true` once
 * the text is on the clipboard and `false` when both routes failed (the caller
 * should say so) or when there was nothing to copy.
 *
 * @param {string} text
 * @param {{ container?: Element }} [options] see copyTextFallback
 * @returns {Promise<boolean>}
 */
export async function copyText(text, options = {}) {
    const value = text === null || text === undefined ? '' : String(text);
    if (value === '') {
        return false;
    }

    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function') {
        try {
            await clipboard.writeText(value);
            return true;
        } catch (error) {
            // Present but refused (permissions policy, an iframe, a lost user activation): try the fallback.
        }
    }
    return copyTextFallback(value, options);
}

/**
 * The common "Copy Id / Case Number / list of Ids" call: turns the value into
 * text with `toClipboardText`, then copies it with `copyText`. Resolves to
 * `false`, leaving the clipboard alone, when there is nothing to copy.
 *
 * @param {*} value a string, number, or an array of them (one per line)
 * @param {{ trim?: boolean, separator?: string, container?: Element }} [options]
 * @returns {Promise<boolean>}
 */
export async function copyValue(value, { trim = true, separator = '\n', container } = {}) {
    const text = toClipboardText(value, { trim, separator });
    return text === '' ? false : copyText(text, { container });
}
