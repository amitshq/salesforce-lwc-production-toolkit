import { LightningElement, api } from 'lwc';
import { copyValue, toClipboardText } from 'c/clipboardUtils';
import { showToast } from 'c/toastService';

// How long the check mark (and the screen-reader message, when there is no toast) stays up.
const FEEDBACK_MS = 2000;

/**
 * A button that copies a value to the clipboard and tells the user it worked:
 * the icon turns into a check mark for a moment, a toast confirms it (or says
 * why it failed), and screen readers are told. Use it next to a record Id, a
 * case number, a share link - anywhere a "Copy" affordance belongs.
 *
 * Icon-only by default; give it a `label` for a labelled button. The button is
 * disabled while there is nothing to copy (an empty value, or whitespace). An
 * array copies one item per line. It copies on the click itself, so it works in
 * browsers that only allow a copy during a user gesture, and it copies from
 * inside its own markup, so it also works inside a focus-trapped `c-modal`.
 *
 * @example
 * <c-copy-button value={recordId} alternative-text="Copy record Id"></c-copy-button>
 * <c-copy-button value={selectedIds} label="Copy Ids" success-message="Ids copied"></c-copy-button>
 */
export default class CopyButton extends LightningElement {
    @api value;
    @api label = '';
    @api alternativeText = 'Copy to clipboard';
    @api iconName = 'utility:copy_to_clipboard';
    @api variant; // icon-only: border, bare, container, brand ...; labelled: neutral, base, brand ...
    @api successMessage = 'Copied to clipboard';
    @api errorMessage = 'Could not copy to the clipboard';
    @api preserveWhitespace = false;
    @api hideToast = false;
    @api disabled = false;

    copied = false;
    statusText = '';
    feedbackTimer;

    disconnectedCallback() {
        clearTimeout(this.feedbackTimer);
    }

    get text() {
        return toClipboardText(this.value, { trim: !this.preserveWhitespace });
    }

    get isDisabled() {
        return this.disabled || this.text === '';
    }

    get hasLabel() {
        return !!this.label;
    }

    get buttonVariant() {
        return this.variant || (this.hasLabel ? 'neutral' : 'border');
    }

    get currentIcon() {
        return this.copied ? 'utility:check' : this.iconName;
    }

    async handleClick() {
        if (this.isDisabled) {
            return;
        }
        const text = this.text;
        // Copy first, before anything else, while the click's user activation is still live.
        const succeeded = await copyValue(this.value, {
            trim: !this.preserveWhitespace,
            container: this.template.querySelector('.clipboard-sink')
        });

        if (succeeded) {
            this.dispatchEvent(new CustomEvent('copied', { detail: { text } }));
        } else {
            this.dispatchEvent(new CustomEvent('copyerror', { detail: { text } }));
        }
        this.showFeedback(succeeded);
    }

    showFeedback(succeeded) {
        const message = succeeded ? this.successMessage : this.errorMessage;
        if (!this.hideToast) {
            // showToast ignores an identical toast shown a moment ago, so repeated clicks do not stack them.
            showToast(this, { title: message, variant: succeeded ? 'success' : 'error' });
        }
        this.copied = succeeded;
        // With a toast the platform announces it; without one, announce it here.
        this.statusText = this.hideToast ? message : '';

        clearTimeout(this.feedbackTimer);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.feedbackTimer = setTimeout(() => {
            this.copied = false;
            this.statusText = '';
        }, FEEDBACK_MS);
    }
}
