import { LightningElement, api } from 'lwc';

/**
 * The inline editor for c-extended-datatable's `lookup` column type: a
 * lightning-record-picker that behaves like the inputs lightning-datatable's
 * inline-edit panel works with - it exposes `value` (the chosen record Id, or null),
 * `validity`, `showHelpMessageIfInvalid()` and `focus()`, and fires `change`.
 */
export default class DatatableLookupEditor extends LightningElement {
    @api label = 'Record';
    @api objectApiName;

    currentValue = null;

    @api
    get value() {
        return this.currentValue;
    }
    set value(recordId) {
        this.currentValue = recordId || null;
    }

    @api
    get validity() {
        const picker = this.picker;
        return picker && picker.validity ? picker.validity : { valid: true };
    }

    @api
    showHelpMessageIfInvalid() {
        const picker = this.picker;
        if (picker && typeof picker.reportValidity === 'function') {
            picker.reportValidity();
        }
    }

    @api
    focus() {
        const picker = this.picker;
        if (picker && typeof picker.focus === 'function') {
            picker.focus();
        }
    }

    get picker() {
        return this.template.querySelector('lightning-record-picker');
    }

    handleChange(event) {
        event.stopPropagation();
        this.currentValue = (event.detail && event.detail.recordId) || null;
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this.currentValue } }));
    }
}
