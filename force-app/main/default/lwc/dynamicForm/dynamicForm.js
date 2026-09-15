import { LightningElement, api } from 'lwc';
import { getFieldAccess } from 'c/permissionUtils';

const CHECKBOX_TYPES = new Set(['checkbox', 'boolean']);
const COMBOBOX_TYPES = new Set(['picklist', 'select']);

/**
 * Renders a form from a plain field-config array instead of a fixed
 * markup template - useful for admin-configurable forms, or any screen
 * that needs "the same form, different fields" across objects.
 *
 * Pairs naturally with GenericDmlService.saveRecords: listen for `submit`
 * and pass `event.detail.values` straight through as one row's `fields`.
 *
 * @example
 * <c-dynamic-form fields={fields} object-api-name="Contact" onsubmit={handleSubmit}></c-dynamic-form>
 *
 * // fields = [
 * //     { apiName: 'LastName', label: 'Last Name', type: 'text', required: true },
 * //     { apiName: 'Email', label: 'Email', type: 'email' },
 * //     { apiName: 'Status__c', label: 'Status', type: 'picklist', options: [{ label: 'Active', value: 'Active' }] }
 * // ]
 */
export default class DynamicForm extends LightningElement {
    @api fields = [];
    @api objectApiName;
    @api submitLabel = 'Save';
    @api cancelLabel = 'Cancel';
    @api hideCancelButton = false;
    @api hideSubmitButton = false;

    @api
    get values() {
        return { ...this._values };
    }
    set values(value) {
        this._values = { ...(value || {}) };
    }

    _values = {};
    fieldAccessByApiName = {};

    connectedCallback() {
        if (this.objectApiName && this.fields.length) {
            getFieldAccess(this.objectApiName, this.fields.map((f) => f.apiName))
                .then((results) => {
                    this.fieldAccessByApiName = Object.fromEntries(results.map((r) => [r.fieldName, r]));
                })
                .catch(() => {
                    // Fall through to showing every field editable - the server still enforces FLS on save.
                });
        }
    }

    get renderedFields() {
        return this.fields.map((field) => {
            const access = this.fieldAccessByApiName[field.apiName];
            const isReadOnly = access ? !access.editable : false;
            return {
                ...field,
                value: this._values[field.apiName] ?? field.defaultValue ?? '',
                isCheckbox: CHECKBOX_TYPES.has(field.type),
                isCombobox: COMBOBOX_TYPES.has(field.type),
                isTextarea: field.type === 'textarea',
                isPlainInput: !CHECKBOX_TYPES.has(field.type) && !COMBOBOX_TYPES.has(field.type) && field.type !== 'textarea',
                inputType: field.type === 'select' ? 'picklist' : field.type || 'text',
                disabled: isReadOnly
            };
        });
    }

    handleFieldChange(event) {
        const apiName = event.currentTarget.dataset.apiName;
        const detail = event.detail || {};
        const value = Object.prototype.hasOwnProperty.call(detail, 'checked') ? detail.checked : detail.value;
        this._values = { ...this._values, [apiName]: value };
    }

    @api
    getValues() {
        return { ...this._values };
    }

    @api
    reportValidity() {
        const inputs = Array.from(this.template.querySelectorAll('lightning-input, lightning-combobox, lightning-textarea'));
        return inputs.map((input) => input.reportValidity()).every(Boolean);
    }

    @api
    reset() {
        this._values = {};
        this.template.querySelectorAll('lightning-input, lightning-combobox, lightning-textarea').forEach((input) => {
            if (typeof input.setCustomValidity === 'function') {
                input.setCustomValidity('');
            }
        });
    }

    handleSubmitClick() {
        if (!this.reportValidity()) {
            return;
        }
        this.dispatchEvent(new CustomEvent('submit', { detail: { values: this.getValues() } }));
    }

    handleCancelClick() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }
}
