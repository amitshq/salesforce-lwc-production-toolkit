import LightningDatatable from 'lightning/datatable';
import picklistTemplate from './picklist.html';
import picklistEditTemplate from './picklistEdit.html';
import lookupTemplate from './lookup.html';
import lookupEditTemplate from './lookupEdit.html';
import richTextTemplate from './richText.html';
import richTextEditTemplate from './richTextEdit.html';
import recordLinkTemplate from './recordLink.html';
import recordLinkEditTemplate from './recordLinkEdit.html';

/**
 * lightning-datatable with four more column types, each editable inline:
 *
 *  - `picklist`: a dropdown. typeAttributes: { options: [{ label, value }], placeholder, label }.
 *  - `lookup`: a record picker; the cell shows the related record's name, linked.
 *    typeAttributes: { objectApiName, label, displayValue, originalValue, nameField, urlTemplate }.
 *    displayValue is the name to show for the loaded value; for a value picked in the
 *    editor (originalValue tells them apart) the name is read from Lightning Data Service.
 *  - `richText`: formatted text, edited with a rich-text editor. typeAttributes: { label }.
 *  - `recordLink`: the value as a link to a record, edited as text. typeAttributes: { url, target, label }.
 *
 * c-enterprise-datatable builds these typeAttributes from its column config, so most
 * pages never set them by hand. It renders this component only when a column needs one
 * of these types; otherwise it uses lightning-datatable itself.
 *
 * The editors are small wrappers (c-datatable-lookup-editor, c-datatable-rich-text-editor)
 * that give the record picker and rich-text editor the value, validity and focus the
 * datatable's inline-edit panel expects from an input.
 */
export default class ExtendedDatatable extends LightningDatatable {
    static customTypes = {
        picklist: {
            template: picklistTemplate,
            editTemplate: picklistEditTemplate,
            standardCellLayout: true,
            typeAttributes: ['label', 'placeholder', 'options']
        },
        lookup: {
            template: lookupTemplate,
            editTemplate: lookupEditTemplate,
            standardCellLayout: true,
            typeAttributes: ['label', 'objectApiName', 'displayValue', 'originalValue', 'nameField', 'urlTemplate']
        },
        richText: {
            template: richTextTemplate,
            editTemplate: richTextEditTemplate,
            standardCellLayout: true,
            typeAttributes: ['label']
        },
        recordLink: {
            template: recordLinkTemplate,
            editTemplate: recordLinkEditTemplate,
            standardCellLayout: true,
            typeAttributes: ['label', 'url', 'target']
        }
    };
}
