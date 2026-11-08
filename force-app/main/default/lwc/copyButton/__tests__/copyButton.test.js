import { createElement } from 'lwc';
import CopyButton from 'c/copyButton';
import { copyValue } from 'c/clipboardUtils';
import { showToast } from 'c/toastService';

jest.mock('c/clipboardUtils', () => ({
    ...jest.requireActual('c/clipboardUtils'),
    copyValue: jest.fn()
}));
jest.mock('c/toastService', () => ({ showToast: jest.fn() }));

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createButton(props = {}) {
    const element = createElement('c-copy-button', { is: CopyButton });
    Object.assign(element, { value: '001xx000003DGbY', ...props });
    document.body.appendChild(element);
    return element;
}

function iconButton(element) {
    return element.shadowRoot.querySelector('lightning-button-icon');
}

function labelledButton(element) {
    return element.shadowRoot.querySelector('lightning-button');
}

function activeButton(element) {
    return iconButton(element) || labelledButton(element);
}

function status(element) {
    return element.shadowRoot.querySelector('[role="status"]').textContent;
}

async function click(element) {
    activeButton(element).click();
    await flushPromises();
}

describe('c-copy-button', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    describe('what it renders', () => {
        it('is an icon-only bordered button by default, with accessible text', () => {
            const element = createButton();

            expect(labelledButton(element)).toBeNull();
            expect(iconButton(element).iconName).toBe('utility:copy_to_clipboard');
            expect(iconButton(element).alternativeText).toBe('Copy to clipboard');
            expect(iconButton(element).variant).toBe('border');
        });

        it('is a labelled neutral button when given a label', () => {
            const element = createButton({ label: 'Copy Id' });

            expect(iconButton(element)).toBeNull();
            expect(labelledButton(element).label).toBe('Copy Id');
            expect(labelledButton(element).variant).toBe('neutral');
            expect(labelledButton(element).iconName).toBe('utility:copy_to_clipboard');
        });

        it('honours a custom variant, icon and alternative text', () => {
            const element = createButton({ variant: 'bare', iconName: 'utility:copy', alternativeText: 'Copy case number' });

            expect(iconButton(element).variant).toBe('bare');
            expect(iconButton(element).iconName).toBe('utility:copy');
            expect(iconButton(element).alternativeText).toBe('Copy case number');
        });
    });

    describe('when there is nothing to copy', () => {
        it.each([[undefined], [null], [''], ['   '], [[]], [[null, ' ']]])('is disabled for %p', async (value) => {
            const element = createButton({ value });

            expect(iconButton(element).disabled).toBe(true);
            await click(element);
            expect(copyValue).not.toHaveBeenCalled();
        });

        it('is enabled once there is something to copy', async () => {
            const element = createButton({ value: '' });
            expect(iconButton(element).disabled).toBe(true);

            element.value = 'CASE-0042';
            await flushPromises();

            expect(iconButton(element).disabled).toBe(false);
        });

        it('treats whitespace as something to copy when whitespace is preserved', () => {
            const element = createButton({ value: '   ', preserveWhitespace: true });

            expect(iconButton(element).disabled).toBe(false);
        });

        it('can be disabled outright', async () => {
            const element = createButton({ disabled: true });

            expect(iconButton(element).disabled).toBe(true);
            await click(element);
            expect(copyValue).not.toHaveBeenCalled();
        });
    });

    describe('copying', () => {
        it('copies the value, trimmed, from inside its own markup', async () => {
            copyValue.mockResolvedValue(true);
            const element = createButton({ value: '  CASE-0042  ' });

            await click(element);

            expect(copyValue).toHaveBeenCalledTimes(1);
            const [value, options] = copyValue.mock.calls[0];
            expect(value).toBe('  CASE-0042  ');
            expect(options.trim).toBe(true);
            expect(options.container).toBe(element.shadowRoot.querySelector('.clipboard-sink'));
        });

        it('does not trim when whitespace is preserved', async () => {
            copyValue.mockResolvedValue(true);
            const element = createButton({ value: '  keep  ', preserveWhitespace: true });

            await click(element);

            expect(copyValue.mock.calls[0][1].trim).toBe(false);
        });

        it('copies a list of values', async () => {
            copyValue.mockResolvedValue(true);
            const element = createButton({ value: ['001A', '001B'] });

            await click(element);

            expect(copyValue.mock.calls[0][0]).toEqual(['001A', '001B']);
        });
    });

    describe('when the copy works', () => {
        it('toasts, fires copied with the text, and turns the icon into a check mark that then reverts', async () => {
            jest.useFakeTimers();
            copyValue.mockResolvedValue(true);
            const element = createButton({ value: '  CASE-0042  ' });
            const handler = jest.fn();
            element.addEventListener('copied', handler);

            activeButton(element).click();
            await jest.advanceTimersByTimeAsync(0);

            expect(showToast).toHaveBeenCalledWith(expect.anything(), { title: 'Copied to clipboard', variant: 'success' });
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler.mock.calls[0][0].detail).toEqual({ text: 'CASE-0042' });
            expect(iconButton(element).iconName).toBe('utility:check');

            await jest.advanceTimersByTimeAsync(1999);
            expect(iconButton(element).iconName).toBe('utility:check');
            await jest.advanceTimersByTimeAsync(1);
            expect(iconButton(element).iconName).toBe('utility:copy_to_clipboard');
        });

        it('shows the custom success message', async () => {
            copyValue.mockResolvedValue(true);
            const element = createButton({ successMessage: 'Id copied' });

            await click(element);

            expect(showToast).toHaveBeenCalledWith(expect.anything(), { title: 'Id copied', variant: 'success' });
        });

        it('restarts the check mark timer on a second click instead of reverting early', async () => {
            jest.useFakeTimers();
            copyValue.mockResolvedValue(true);
            const element = createButton();

            activeButton(element).click();
            await jest.advanceTimersByTimeAsync(1500);
            activeButton(element).click();
            await jest.advanceTimersByTimeAsync(1500);

            expect(iconButton(element).iconName).toBe('utility:check');
            await jest.advanceTimersByTimeAsync(500);
            expect(iconButton(element).iconName).toBe('utility:copy_to_clipboard');
        });

        it('keeps the status message empty while a toast is doing the announcing', async () => {
            copyValue.mockResolvedValue(true);
            const element = createButton();

            await click(element);

            expect(status(element)).toBe('');
        });
    });

    describe('when the copy fails', () => {
        it('toasts the error, fires copyerror and keeps the normal icon', async () => {
            copyValue.mockResolvedValue(false);
            const element = createButton({ value: 'CASE-0042' });
            const handler = jest.fn();
            const copiedHandler = jest.fn();
            element.addEventListener('copyerror', handler);
            element.addEventListener('copied', copiedHandler);

            await click(element);

            expect(showToast).toHaveBeenCalledWith(expect.anything(), { title: 'Could not copy to the clipboard', variant: 'error' });
            expect(handler.mock.calls[0][0].detail).toEqual({ text: 'CASE-0042' });
            expect(copiedHandler).not.toHaveBeenCalled();
            expect(iconButton(element).iconName).toBe('utility:copy_to_clipboard');
        });

        it('shows the custom error message', async () => {
            copyValue.mockResolvedValue(false);
            const element = createButton({ errorMessage: 'Select the text and press Ctrl+C' });

            await click(element);

            expect(showToast).toHaveBeenCalledWith(expect.anything(), { title: 'Select the text and press Ctrl+C', variant: 'error' });
        });
    });

    describe('without a toast', () => {
        it('shows none, and announces the result to screen readers instead', async () => {
            copyValue.mockResolvedValue(true);
            const element = createButton({ hideToast: true });

            await click(element);

            expect(showToast).not.toHaveBeenCalled();
            expect(status(element)).toBe('Copied to clipboard');
        });

        it('announces a failure too, and clears the message afterwards', async () => {
            jest.useFakeTimers();
            copyValue.mockResolvedValue(false);
            const element = createButton({ hideToast: true });

            activeButton(element).click();
            await jest.advanceTimersByTimeAsync(0);
            expect(status(element)).toBe('Could not copy to the clipboard');

            await jest.advanceTimersByTimeAsync(2000);
            expect(status(element)).toBe('');
        });
    });

    describe('cleanup', () => {
        it('cancels the pending check-mark timer when it leaves the page', async () => {
            jest.useFakeTimers();
            copyValue.mockResolvedValue(true);
            const element = createButton();
            activeButton(element).click();
            await jest.advanceTimersByTimeAsync(0);
            expect(jest.getTimerCount()).toBe(1);

            document.body.removeChild(element);

            expect(jest.getTimerCount()).toBe(0);
        });
    });
});
