import { LightningElement, api } from 'lwc';

/**
 * The inline editor for c-extended-datatable's `richText` column type: a
 * lightning-input-rich-text that behaves like the inputs lightning-datatable's
 * inline-edit panel works with - it exposes `value`, `validity`,
 * `showHelpMessageIfInvalid()` and `focus()`, and fires `change`.
 */
export default class DatatableRichTextEditor extends LightningElement {
    @api label = 'Text';

    currentValue = '';

    @api
    get value() {
        return this.currentValue;
    }
    set value(html) {
        this.currentValue = html || '';
    }

    @api
    get validity() {
        return { valid: true };
    }

    @api
    showHelpMessageIfInvalid() {
        // Any rich text is valid; there is nothing to show.
    }

    @api
    focus() {
        const editor = this.template.querySelector('lightning-input-rich-text');
        if (editor && typeof editor.focus === 'function') {
            editor.focus();
        }
    }

    handleChange(event) {
        event.stopPropagation();
        this.currentValue = event.target.value || '';
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this.currentValue } }));
    }
}
