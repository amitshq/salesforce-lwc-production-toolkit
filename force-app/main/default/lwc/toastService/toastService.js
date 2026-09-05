import { ShowToastEvent } from 'lightning/platformShowToastEvent';

/**
 * Consistent toast dispatch, plus de-duplication: it's common for both a
 * @wire's error callback and a surrounding try/catch to fire for the same
 * underlying failure, which otherwise stacks two identical toasts. Toasts
 * are dispatched from a component instance (ShowToastEvent bubbles up from
 * `component.dispatchEvent`), so every function here takes that component
 * as its first argument.
 */

const DEDUPE_WINDOW_MS = 3000;
const recentToastKeys = new Map();

function isDuplicate(key) {
    const lastShownAt = recentToastKeys.get(key);
    const now = Date.now();
    if (lastShownAt && now - lastShownAt < DEDUPE_WINDOW_MS) {
        return true;
    }
    recentToastKeys.set(key, now);
    // Opportunistic cleanup so the map doesn't grow unbounded over a long session.
    for (const [existingKey, shownAt] of recentToastKeys) {
        if (now - shownAt > DEDUPE_WINDOW_MS) {
            recentToastKeys.delete(existingKey);
        }
    }
    return false;
}

/**
 * @param {object} component the LightningElement instance to dispatch from
 * @param {object} toast
 * @param {string} toast.title
 * @param {string} [toast.message]
 * @param {'success'|'error'|'warning'|'info'} [toast.variant]
 * @param {'dismissable'|'pester'|'sticky'} [toast.mode]
 * @param {Array|object} [toast.messageData]
 * @param {boolean} [toast.allowDuplicate] bypass de-duplication for this call
 */
export function showToast(component, { title, message, variant = 'info', mode = 'dismissable', messageData, allowDuplicate = false }) {
    const key = `${title}|${message}|${variant}`;
    if (!allowDuplicate && isDuplicate(key)) {
        return;
    }
    component.dispatchEvent(new ShowToastEvent({ title, message, variant, mode, messageData }));
}

export function showSuccessToast(component, message, title = 'Success') {
    showToast(component, { title, message, variant: 'success' });
}

export function showInfoToast(component, message, title = 'Info') {
    showToast(component, { title, message, variant: 'info' });
}

export function showWarningToast(component, message, title = 'Warning') {
    showToast(component, { title, message, variant: 'warning' });
}

/**
 * @param {object} component
 * @param {string|string[]} messageOrMessages typically the output of reduceApexErrors/reduceLdsErrors
 * @param {string} [title]
 */
export function showErrorToast(component, messageOrMessages, title = 'Error') {
    const message = Array.isArray(messageOrMessages) ? messageOrMessages.join(' ') : messageOrMessages;
    showToast(component, { title, message, variant: 'error', mode: 'sticky' });
}

/** Resets the de-duplication window - useful in tests, or after navigating to a new page context. */
export function clearToastDedupeState() {
    recentToastKeys.clear();
}
