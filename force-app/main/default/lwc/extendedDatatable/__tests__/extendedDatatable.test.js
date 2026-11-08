import { createElement } from 'lwc';
import ExtendedDatatable from 'c/extendedDatatable';

describe('c-extended-datatable', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('registers the four editable custom types with a view and an edit template each', () => {
        const types = ExtendedDatatable.customTypes;

        expect(Object.keys(types).sort()).toEqual(['lookup', 'picklist', 'recordLink', 'richText']);
        Object.values(types).forEach((type) => {
            expect(typeof type.template).toBe('function');
            expect(typeof type.editTemplate).toBe('function');
            expect(type.standardCellLayout).toBe(true);
        });
    });

    it('accepts the type attributes c-enterprise-datatable sends', () => {
        const types = ExtendedDatatable.customTypes;

        expect(types.picklist.typeAttributes).toEqual(expect.arrayContaining(['options', 'placeholder', 'label']));
        expect(types.lookup.typeAttributes).toEqual(
            expect.arrayContaining(['objectApiName', 'displayValue', 'originalValue', 'nameField', 'urlTemplate', 'label'])
        );
        expect(types.recordLink.typeAttributes).toEqual(expect.arrayContaining(['url', 'target', 'label']));
        expect(types.richText.typeAttributes).toEqual(['label']);
    });

    it('is still a datatable, taking data and columns', () => {
        const element = createElement('c-extended-datatable', { is: ExtendedDatatable });
        element.keyField = 'Id';
        element.columns = [{ label: 'Name', fieldName: 'Name', type: 'recordLink' }];
        element.data = [{ Id: '001', Name: 'Acme' }];
        document.body.appendChild(element);

        expect(element.columns[0].type).toBe('recordLink');
        expect(element.data).toHaveLength(1);
    });
});
