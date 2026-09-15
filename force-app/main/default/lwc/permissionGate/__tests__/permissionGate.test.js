import { createElement } from 'lwc';
import PermissionGate from 'c/permissionGate';
import { getObjectAccess, getFieldAccess, hasCustomPermission } from 'c/permissionUtils';

jest.mock('c/permissionUtils', () => ({
    getObjectAccess: jest.fn(),
    getFieldAccess: jest.fn(),
    hasCustomPermission: jest.fn()
}));

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('c-permission-gate', () => {
    afterEach(() => {
        jest.clearAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('shows the default slot with no checks configured (nothing to gate on)', async () => {
        const element = createElement('c-permission-gate', { is: PermissionGate });
        document.body.appendChild(element);
        await flushPromises();

        expect(element.shadowRoot.querySelector('slot:not([name])')).not.toBeNull();
    });

    it('shows content when the object access check passes', async () => {
        getObjectAccess.mockResolvedValue({ isDeletable: true });
        const element = createElement('c-permission-gate', { is: PermissionGate });
        element.objectApiName = 'Account';
        element.requiredAccess = 'delete';
        document.body.appendChild(element);
        await flushPromises();

        expect(getObjectAccess).toHaveBeenCalledWith('Account');
        expect(element.shadowRoot.querySelector('slot:not([name])')).not.toBeNull();
        expect(element.shadowRoot.querySelector('slot[name="noaccess"]')).toBeNull();
    });

    it('shows the noaccess slot when the object access check fails', async () => {
        getObjectAccess.mockResolvedValue({ isDeletable: false });
        const element = createElement('c-permission-gate', { is: PermissionGate });
        element.objectApiName = 'Account';
        element.requiredAccess = 'delete';
        document.body.appendChild(element);
        await flushPromises();

        expect(element.shadowRoot.querySelector('slot[name="noaccess"]')).not.toBeNull();
        expect(element.shadowRoot.querySelector('slot:not([name])')).toBeNull();
    });

    it('checks field access when both objectApiName and fieldApiName are set', async () => {
        getObjectAccess.mockResolvedValue({ isAccessible: true });
        getFieldAccess.mockResolvedValue([{ fieldName: 'AnnualRevenue', readable: true, editable: false }]);
        const element = createElement('c-permission-gate', { is: PermissionGate });
        element.objectApiName = 'Account';
        element.fieldApiName = 'AnnualRevenue';
        element.requiredAccess = 'edit';
        document.body.appendChild(element);
        await flushPromises();

        expect(getFieldAccess).toHaveBeenCalledWith('Account', ['AnnualRevenue']);
        expect(element.shadowRoot.querySelector('slot[name="noaccess"]')).not.toBeNull();
    });

    it('checks a custom permission when configured', async () => {
        hasCustomPermission.mockResolvedValue(true);
        const element = createElement('c-permission-gate', { is: PermissionGate });
        element.customPermission = 'Toolkit_Bulk_Edit';
        document.body.appendChild(element);
        await flushPromises();

        expect(hasCustomPermission).toHaveBeenCalledWith('Toolkit_Bulk_Edit');
        expect(element.shadowRoot.querySelector('slot:not([name])')).not.toBeNull();
    });

    it('requires every configured check to pass (AND, not OR)', async () => {
        getObjectAccess.mockResolvedValue({ isAccessible: true });
        hasCustomPermission.mockResolvedValue(false);
        const element = createElement('c-permission-gate', { is: PermissionGate });
        element.objectApiName = 'Account';
        element.customPermission = 'Toolkit_Bulk_Edit';
        document.body.appendChild(element);
        await flushPromises();

        expect(element.shadowRoot.querySelector('slot[name="noaccess"]')).not.toBeNull();
    });

    it('treats a rejected permission check as no access rather than throwing', async () => {
        getObjectAccess.mockRejectedValue(new Error('boom'));
        const element = createElement('c-permission-gate', { is: PermissionGate });
        element.objectApiName = 'Account';
        document.body.appendChild(element);
        await flushPromises();

        expect(element.shadowRoot.querySelector('slot[name="noaccess"]')).not.toBeNull();
    });
});
