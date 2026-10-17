import { LightningElement, api } from 'lwc';

/**
 * A panel of checkboxes for choosing which columns a table shows. Purely
 * presentational: it never changes `visibleFields` itself, it reports the
 * new selection in a `change` event and the owner decides what to do.
 *
 * At least one column always stays visible - unchecking the last one is
 * refused. `visibleFields` omitted (or null) means every column is shown.
 * Order follows `columns`, not the order the user clicked.
 *
 * @example
 * <c-column-chooser
 *     columns={chooserColumns}
 *     visible-fields={visibleFields}
 *     onchange={handleChange}
 * ></c-column-chooser>
 *
 * // chooserColumns = [{ fieldName: 'Name', label: 'Account Name' }, { fieldName: 'Phone', label: 'Phone' }]
 * // handleChange(event) -> event.detail.visibleFields === ['Name']
 */
export default class ColumnChooser extends LightningElement {
    @api columns = [];
    @api visibleFields;

    get allFields() {
        return (this.columns || []).map((column) => column.fieldName).filter(Boolean);
    }

    get shownFields() {
        if (!Array.isArray(this.visibleFields)) {
            return this.allFields;
        }
        return this.allFields.filter((fieldName) => this.visibleFields.includes(fieldName));
    }

    get items() {
        const shown = new Set(this.shownFields);
        return (this.columns || [])
            .filter((column) => column.fieldName)
            .map((column) => ({
                fieldName: column.fieldName,
                label: column.label || column.fieldName,
                checked: shown.has(column.fieldName)
            }));
    }

    get allVisible() {
        return this.shownFields.length === this.allFields.length;
    }

    handleToggle(event) {
        const { fieldName } = event.currentTarget.dataset;
        const shown = new Set(this.shownFields);
        if (event.target.checked) {
            shown.add(fieldName);
        } else {
            shown.delete(fieldName);
        }
        if (shown.size === 0) {
            // A table with no columns is useless: put the box back instead of emitting.
            event.target.checked = true;
            return;
        }
        this.emitChange(this.allFields.filter((name) => shown.has(name)));
    }

    handleShowAll() {
        this.emitChange(this.allFields);
    }

    emitChange(visibleFields) {
        this.dispatchEvent(new CustomEvent('change', { detail: { visibleFields } }));
    }
}
