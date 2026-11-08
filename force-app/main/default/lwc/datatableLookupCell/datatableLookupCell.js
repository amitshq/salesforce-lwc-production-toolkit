import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { recordUrl } from 'c/datatableHelpers';

/**
 * How c-extended-datatable shows a `lookup` cell: the related record's name, linked
 * to it. The name loaded with the row (displayValue) is used while the cell still
 * holds the loaded Id. Once the user picks another record - or after a save, when
 * the loaded name is out of date - the name is read through Lightning Data Service.
 * Until it arrives, or if the user cannot see it, the Id is shown instead.
 */
export default class DatatableLookupCell extends LightningElement {
    @api urlTemplate;

    settings = { value: undefined, originalValue: undefined, displayValue: undefined, objectApiName: undefined, nameField: 'Name' };
    recordIdToRead;
    fieldsToRead;

    @wire(getRecord, { recordId: '$recordIdToRead', optionalFields: '$fieldsToRead' })
    relatedRecord;

    @api
    get value() {
        return this.settings.value;
    }
    set value(recordId) {
        this.update({ value: recordId });
    }

    @api
    get originalValue() {
        return this.settings.originalValue;
    }
    set originalValue(recordId) {
        this.update({ originalValue: recordId });
    }

    @api
    get displayValue() {
        return this.settings.displayValue;
    }
    set displayValue(name) {
        this.update({ displayValue: name });
    }

    @api
    get objectApiName() {
        return this.settings.objectApiName;
    }
    set objectApiName(name) {
        this.update({ objectApiName: name });
    }

    @api
    get nameField() {
        return this.settings.nameField;
    }
    set nameField(name) {
        this.update({ nameField: name || 'Name' });
    }

    update(changes) {
        this.settings = { ...this.settings, ...changes };
        const { value, originalValue, displayValue, objectApiName, nameField } = this.settings;
        const needsName = !!value && !!objectApiName && (value !== originalValue || !displayValue);
        this.fieldsToRead = objectApiName ? [`${objectApiName}.${nameField}`] : undefined;
        this.recordIdToRead = needsName ? value : undefined;
    }

    get hasValue() {
        return !!this.settings.value;
    }

    get label() {
        const { value, displayValue } = this.settings;
        if (!value) {
            return '';
        }
        if (!this.recordIdToRead) {
            return displayValue || value;
        }
        const data = this.relatedRecord && this.relatedRecord.data;
        const name = data ? getFieldValue(data, this.fieldsToRead[0]) : undefined;
        return name || value;
    }

    get href() {
        return this.urlTemplate ? recordUrl(this.urlTemplate, this.settings.value) : undefined;
    }
}
