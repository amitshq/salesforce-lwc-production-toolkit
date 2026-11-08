import LightningModal from 'lightning/modal';
import { api } from 'lwc';

const NUMBER_TYPES = new Set(['number', 'currency', 'percent']);
const PLAIN_INPUT_TYPES = { email: 'email', phone: 'tel', url: 'url', date: 'date', datetime: 'datetime', number: 'number' };

/**
 * Asks which field to set, and to what, on every selected row of
 * c-enterprise-datatable ("mass update"). Resolves with `{ fieldName, value }`, or
 * undefined when cancelled. An empty value clears the field, and the buttons say so.
 *
 * Each field is `{ fieldName, label, type, options?, objectApiName? }` - the table's
 * editable columns. The value input follows the type: a dropdown for a picklist
 * (`options`), a record picker for a lookup (`objectApiName`), a checkbox, a rich-text
 * editor, or a plain input for text, numbers, dates, emails, phones and URLs.
 *
 * @example
 * const choice = await MassUpdateDialog.open({ size: 'small', recordCount: 12, fields });
 * if (choice) { ... choice.fieldName, choice.value ... }
 */
export default class MassUpdateDialog extends LightningModal {
    @api recordCount = 0;
    @api fields = [];

    selectedFieldName;
    value = '';
    checked = false;

    connectedCallback() {
        this.selectedFieldName = this.fields && this.fields.length ? this.fields[0].fieldName : undefined;
    }

    get selectedField() {
        return (this.fields || []).find((field) => field.fieldName === this.selectedFieldName) || {};
    }

    get type() {
        return this.selectedField.type || 'text';
    }

    get fieldOptions() {
        return (this.fields || []).map((field) => ({ label: field.label || field.fieldName, value: field.fieldName }));
    }

    get valueLabel() {
        return `New ${this.selectedField.label || 'value'}`;
    }

    get isPicklist() {
        return this.type === 'picklist';
    }

    get isLookup() {
        return this.type === 'lookup';
    }

    get isCheckbox() {
        return this.type === 'boolean' || this.type === 'checkbox';
    }

    get isRichText() {
        return this.type === 'richText';
    }

    get inputType() {
        return NUMBER_TYPES.has(this.type) ? 'number' : PLAIN_INPUT_TYPES[this.type] || 'text';
    }

    get inputFormatter() {
        return this.type === 'currency' ? 'currency' : this.type === 'percent' ? 'percent-fixed' : undefined;
    }

    get inputStep() {
        return NUMBER_TYPES.has(this.type) ? 'any' : undefined;
    }

    get picklistOptions() {
        return (this.selectedField.options || []).filter((option) => option.value !== '');
    }

    get isClearing() {
        return !this.isCheckbox && (this.value === '' || this.value === null || this.value === undefined);
    }

    get recordWord() {
        return `${this.recordCount} record${this.recordCount === 1 ? '' : 's'}`;
    }

    get summary() {
        const label = this.selectedField.label || 'This field';
        return this.isClearing
            ? `The value is empty, so ${label} will be cleared on ${this.recordWord}.`
            : `${label} will be set to this value on ${this.recordWord}.`;
    }

    get applyLabel() {
        return this.isClearing ? `Clear on ${this.recordWord}` : `Update ${this.recordWord}`;
    }

    get applyVariant() {
        return this.isClearing ? 'destructive' : 'brand';
    }

    get cannotApply() {
        return !this.selectedFieldName;
    }

    handleFieldChange(event) {
        this.selectedFieldName = event.detail.value;
        this.value = '';
        this.checked = false;
    }

    handleValueChange(event) {
        // lightning-input and -combobox report the value in detail; the rich-text editor only on target.
        const fromDetail = event.detail ? event.detail.value : undefined;
        this.value = fromDetail ?? event.target.value ?? '';
    }

    handleLookupChange(event) {
        this.value = event.detail.recordId || '';
    }

    handleCheckboxChange(event) {
        this.checked = event.target.checked;
    }

    handleCancel() {
        this.close(undefined);
    }

    handleApply() {
        const input = this.template.querySelector('.value-input');
        if (input && typeof input.reportValidity === 'function' && input.reportValidity() === false) {
            return;
        }
        this.close({ fieldName: this.selectedFieldName, value: this.normalizedValue() });
    }

    normalizedValue() {
        if (this.isCheckbox) {
            return !!this.checked;
        }
        if (this.isClearing) {
            return null;
        }
        return NUMBER_TYPES.has(this.type) ? Number(this.value) : this.value;
    }
}
