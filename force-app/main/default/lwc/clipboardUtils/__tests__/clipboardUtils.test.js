import { copyText, copyTextFallback, copyValue, toClipboardText } from 'c/clipboardUtils';

// The lint rule forbids document-level queries; the temporary textarea is always somewhere under the body.
function textareaInPage() {
    return document.body.querySelector('textarea');
}

function setClipboard(value) {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, writable: true, value });
}

describe('clipboardUtils', () => {
    beforeEach(() => {
        // jsdom has no document.execCommand.
        document.execCommand = jest.fn().mockReturnValue(true);
        setClipboard(undefined);
    });

    afterEach(() => {
        delete document.execCommand;
        setClipboard(undefined);
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    describe('toClipboardText', () => {
        it('turns nothing into an empty string', () => {
            expect(toClipboardText(null)).toBe('');
            expect(toClipboardText(undefined)).toBe('');
            expect(toClipboardText('')).toBe('');
            expect(toClipboardText('   ')).toBe('');
        });

        it('trims by default and keeps whitespace on request', () => {
            expect(toClipboardText('  CASE-0042 \n')).toBe('CASE-0042');
            expect(toClipboardText('  keep  ', { trim: false })).toBe('  keep  ');
        });

        it('converts numbers and other primitives', () => {
            expect(toClipboardText(42)).toBe('42');
            expect(toClipboardText(0)).toBe('0');
            expect(toClipboardText(false)).toBe('false');
        });

        it('puts each array item on its own line and drops blank ones', () => {
            expect(toClipboardText(['001A', ' 001B ', '', null, undefined, '  ', '001C'])).toBe('001A\n001B\n001C');
        });

        it('joins with a custom separator', () => {
            expect(toClipboardText(['a', 'b', 'c'], { separator: ', ' })).toBe('a, b, c');
        });

        it('keeps whitespace-only items when not trimming, but still drops empty ones', () => {
            expect(toClipboardText(['a', ' ', '', 'b'], { trim: false, separator: '|' })).toBe('a| |b');
        });

        it('flattens nested arrays', () => {
            expect(toClipboardText(['a', ['b', 'c']], { separator: ',' })).toBe('a,b,c');
        });

        it('returns an empty string for an array with nothing in it', () => {
            expect(toClipboardText([])).toBe('');
            expect(toClipboardText([null, ' ', ''])).toBe('');
        });
    });

    describe('copyTextFallback', () => {
        it('copies through a textarea that is in the page, holds the text and has focus while the copy runs', () => {
            let seen;
            document.execCommand.mockImplementation((command) => {
                const field = textareaInPage();
                seen = { command, value: field.value, focused: document.activeElement === field, readonly: field.readOnly };
                return true;
            });

            expect(copyTextFallback('001xx000003DGbY')).toBe(true);

            expect(seen).toEqual({ command: 'copy', value: '001xx000003DGbY', focused: true, readonly: true });
        });

        it('removes the textarea afterwards', () => {
            copyTextFallback('abc');

            expect(textareaInPage()).toBeNull();
        });

        it('keeps line breaks in multi-line text', () => {
            let copied;
            document.execCommand.mockImplementation(() => {
                copied = textareaInPage().value;
                return true;
            });

            copyTextFallback('001A\n001B\n001C');

            expect(copied).toBe('001A\n001B\n001C');
        });

        it('hides the textarea from people and assistive technology, and keeps iOS from zooming in', () => {
            let field;
            document.execCommand.mockImplementation(() => {
                field = textareaInPage();
                return true;
            });

            copyTextFallback('abc');

            expect(field.getAttribute('aria-hidden')).toBe('true');
            expect(field.tabIndex).toBe(-1);
            expect(field.style.opacity).toBe('0');
            expect(field.style.position).toBe('fixed');
            expect(field.style.fontSize).toBe('16px');
        });

        it('gives focus back to whatever had it before', () => {
            const button = document.createElement('button');
            document.body.appendChild(button);
            button.focus();
            expect(document.activeElement).toBe(button);

            copyTextFallback('abc');

            expect(document.activeElement).toBe(button);
        });

        it('gives focus back even when the copy fails', () => {
            const button = document.createElement('button');
            document.body.appendChild(button);
            button.focus();
            document.execCommand.mockReturnValue(false);

            expect(copyTextFallback('abc')).toBe(false);

            expect(document.activeElement).toBe(button);
        });

        it('puts the textarea in the container it is given', () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            let parent;
            document.execCommand.mockImplementation(() => {
                parent = textareaInPage().parentNode;
                return true;
            });

            copyTextFallback('abc', { container });

            expect(parent).toBe(container);
            expect(container.children).toHaveLength(0);
        });

        it('removes the textarea and reports failure when the copy throws', () => {
            document.execCommand.mockImplementation(() => {
                throw new Error('blocked');
            });

            expect(copyTextFallback('abc')).toBe(false);
            expect(textareaInPage()).toBeNull();
        });

        it('removes the textarea and reports failure when selecting it throws', () => {
            const realCreate = document.createElement.bind(document);
            const spy = jest.spyOn(document, 'createElement').mockImplementation((tag) => {
                const element = realCreate(tag);
                if (tag === 'textarea') {
                    element.select = () => {
                        throw new Error('no selection');
                    };
                }
                return element;
            });

            try {
                expect(copyTextFallback('abc')).toBe(false);
                expect(textareaInPage()).toBeNull();
            } finally {
                spy.mockRestore();
            }
        });

        it('reports failure when the browser says no', () => {
            document.execCommand.mockReturnValue(false);

            expect(copyTextFallback('abc')).toBe(false);
        });

        it('reports failure when execCommand does not exist at all', () => {
            delete document.execCommand;

            expect(copyTextFallback('abc')).toBe(false);
            expect(textareaInPage()).toBeNull();
        });

        it('refuses empty text without touching the page', () => {
            const append = jest.spyOn(document.body, 'appendChild');

            expect(copyTextFallback('')).toBe(false);
            expect(copyTextFallback(null)).toBe(false);
            expect(copyTextFallback(undefined)).toBe(false);

            expect(append).not.toHaveBeenCalled();
            expect(document.execCommand).not.toHaveBeenCalled();
            append.mockRestore();
        });
    });

    describe('copyText', () => {
        it('uses the Clipboard API when it is there', async () => {
            const writeText = jest.fn().mockResolvedValue(undefined);
            setClipboard({ writeText });

            await expect(copyText('001xx000003DGbY')).resolves.toBe(true);

            expect(writeText).toHaveBeenCalledWith('001xx000003DGbY');
            expect(document.execCommand).not.toHaveBeenCalled();
        });

        it('falls back when the Clipboard API rejects', async () => {
            const writeText = jest.fn().mockRejectedValue(new Error('denied'));
            setClipboard({ writeText });

            await expect(copyText('abc')).resolves.toBe(true);

            expect(writeText).toHaveBeenCalled();
            expect(document.execCommand).toHaveBeenCalledWith('copy');
        });

        it('falls back when the Clipboard API is missing', async () => {
            await expect(copyText('abc')).resolves.toBe(true);

            expect(document.execCommand).toHaveBeenCalledWith('copy');
        });

        it('falls back when the Clipboard API exists without writeText', async () => {
            setClipboard({});

            await expect(copyText('abc')).resolves.toBe(true);

            expect(document.execCommand).toHaveBeenCalledWith('copy');
        });

        it('copies in the same turn when there is no Clipboard API, so the click\'s user activation is still live', () => {
            copyText('abc');

            // No await: this has to have happened synchronously.
            expect(document.execCommand).toHaveBeenCalledWith('copy');
        });

        it('resolves false when both routes fail', async () => {
            setClipboard({ writeText: jest.fn().mockRejectedValue(new Error('denied')) });
            document.execCommand.mockReturnValue(false);

            await expect(copyText('abc')).resolves.toBe(false);
        });

        it('hands the container to the fallback', async () => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            let parent;
            document.execCommand.mockImplementation(() => {
                parent = textareaInPage().parentNode;
                return true;
            });

            await copyText('abc', { container });

            expect(parent).toBe(container);
        });

        it('refuses empty text and leaves the clipboard alone', async () => {
            const writeText = jest.fn().mockResolvedValue(undefined);
            setClipboard({ writeText });

            await expect(copyText('')).resolves.toBe(false);
            await expect(copyText(null)).resolves.toBe(false);
            await expect(copyText(undefined)).resolves.toBe(false);

            expect(writeText).not.toHaveBeenCalled();
            expect(document.execCommand).not.toHaveBeenCalled();
        });

        it('converts non-strings to text', async () => {
            const writeText = jest.fn().mockResolvedValue(undefined);
            setClipboard({ writeText });

            await copyText(12345);

            expect(writeText).toHaveBeenCalledWith('12345');
        });
    });

    describe('copyValue', () => {
        let writeText;

        beforeEach(() => {
            writeText = jest.fn().mockResolvedValue(undefined);
            setClipboard({ writeText });
        });

        it('trims whitespace by default', async () => {
            await expect(copyValue('  CASE-0042  ')).resolves.toBe(true);

            expect(writeText).toHaveBeenCalledWith('CASE-0042');
        });

        it('keeps whitespace when asked not to trim', async () => {
            await expect(copyValue('  keep  ', { trim: false })).resolves.toBe(true);

            expect(writeText).toHaveBeenCalledWith('  keep  ');
        });

        it('copies a list as one item per line', async () => {
            await expect(copyValue(['001A', '001B', '', '001C'])).resolves.toBe(true);

            expect(writeText).toHaveBeenCalledWith('001A\n001B\n001C');
        });

        it('copies a list with a custom separator', async () => {
            await copyValue(['a', 'b'], { separator: ', ' });

            expect(writeText).toHaveBeenCalledWith('a, b');
        });

        it('copies numbers, including zero', async () => {
            await copyValue(0);

            expect(writeText).toHaveBeenCalledWith('0');
        });

        it('resolves false and does not touch the clipboard for blank values', async () => {
            await expect(copyValue('   ')).resolves.toBe(false);
            await expect(copyValue(null)).resolves.toBe(false);
            await expect(copyValue([])).resolves.toBe(false);
            await expect(copyValue([null, ' '])).resolves.toBe(false);

            expect(writeText).not.toHaveBeenCalled();
            expect(document.execCommand).not.toHaveBeenCalled();
        });

        it('passes the container through to the fallback', async () => {
            setClipboard(undefined);
            const container = document.createElement('div');
            document.body.appendChild(container);
            let parent;
            document.execCommand.mockImplementation(() => {
                parent = textareaInPage().parentNode;
                return true;
            });

            await copyValue('abc', { container });

            expect(parent).toBe(container);
        });

        it('copies in the same turn when there is no Clipboard API', () => {
            setClipboard(undefined);

            copyValue('abc');

            expect(document.execCommand).toHaveBeenCalledWith('copy');
        });
    });
});
