import { LightningElement, api } from 'lwc';

const OPERATOR_LABELS = {
    '=': 'Equals',
    '!=': 'Not equal to',
    '<': 'Less than',
    '<=': 'Less than or equal',
    '>': 'Greater than',
    '>=': 'Greater than or equal',
    LIKE: 'Contains',
    IN: 'In (comma-separated)',
    'NOT IN': 'Not in (comma-separated)'
};

const OPERATORS_BY_TYPE = {
    text: ['=', '!=', 'LIKE'],
    number: ['=', '!=', '<', '<=', '>', '>='],
    currency: ['=', '!=', '<', '<=', '>', '>='],
    date: ['=', '!=', '<', '<=', '>', '>='],
    boolean: ['='],
    picklist: ['=', '!=', 'IN', 'NOT IN']
};

let nextRowId = 0;

/**
 * Builds a list of filter conditions and emits it in exactly the
 * QueryFilter shape GenericQueryService.query() expects
 * ({ fieldName, operatorName, value }), so it drops straight into
 * c-enterprise-datatable's `static-filters` or a direct Apex call.
 *
 * @example
 * <c-dynamic-filter-panel fields={filterableFields} onchange={handleFiltersChange}></c-dynamic-filter-panel>
 *
 * // filterableFields = [
 * //     { label: 'Industry', value: 'Industry', type: 'text' },
 * //     { label: 'Annual Revenue', value: 'AnnualRevenue', type: 'currency' }
 * // ]
 * // handleFiltersChange(event) { this.filters = event.detail.value; }
 */
export default class DynamicFilterPanel extends LightningElement {
    @api fields = [];
    @api addLabel = 'Add filter';

    rows = [];

    get fieldOptions() {
        return this.fields.map((f) => ({ label: f.label, value: f.value }));
    }

    get renderedRows() {
        return this.rows.map((row) => {
            const fieldDef = this.fields.find((f) => f.value === row.fieldName);
            const type = fieldDef ? fieldDef.type || 'text' : 'text';
            const operators = (OPERATORS_BY_TYPE[type] || OPERATORS_BY_TYPE.text).map((op) => ({
                label: OPERATOR_LABELS[op],
                value: op
            }));
            const inputType = { number: 'number', currency: 'number', date: 'date', boolean: 'checkbox' }[type] || 'text';
            return { ...row, operatorOptions: operators, inputType, isBoolean: type === 'boolean' };
        });
    }

    get hasRows() {
        return this.rows.length > 0;
    }

    @api
    addCondition() {
        const firstField = this.fields[0];
        this.rows = [
            ...this.rows,
            {
                key: `row-${nextRowId++}`,
                fieldName: firstField ? firstField.value : '',
                operatorName: '=',
                value: ''
            }
        ];
    }

    @api
    clearAll() {
        this.rows = [];
        this.notifyChange();
    }

    @api
    get value() {
        return this.buildFilters();
    }

    handleAddClick() {
        this.addCondition();
    }

    handleRemoveClick(event) {
        const key = event.currentTarget.dataset.key;
        this.rows = this.rows.filter((row) => row.key !== key);
        this.notifyChange();
    }

    handleFieldChange(event) {
        const key = event.currentTarget.dataset.key;
        const fieldName = event.detail.value;
        this.rows = this.rows.map((row) => (row.key === key ? { ...row, fieldName, value: '' } : row));
        this.notifyChange();
    }

    handleOperatorChange(event) {
        const key = event.currentTarget.dataset.key;
        const operatorName = event.detail.value;
        this.rows = this.rows.map((row) => (row.key === key ? { ...row, operatorName } : row));
        this.notifyChange();
    }

    handleValueChange(event) {
        const key = event.currentTarget.dataset.key;
        const detail = event.detail || {};
        const rawValue = Object.prototype.hasOwnProperty.call(detail, 'checked') ? detail.checked : detail.value;
        this.rows = this.rows.map((row) => (row.key === key ? { ...row, value: rawValue } : row));
        this.notifyChange();
    }

    buildFilters() {
        return this.rows
            .filter((row) => row.fieldName && row.value !== '' && row.value !== null && row.value !== undefined)
            .map((row) => {
                let value = row.value;
                if ((row.operatorName === 'IN' || row.operatorName === 'NOT IN') && typeof value === 'string') {
                    value = value.split(',').map((v) => v.trim()).filter(Boolean);
                }
                return { fieldName: row.fieldName, operatorName: row.operatorName, value };
            });
    }

    notifyChange() {
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this.buildFilters() } }));
    }
}
