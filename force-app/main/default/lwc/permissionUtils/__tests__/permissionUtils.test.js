import checkObjectAccessApex from '@salesforce/apex/PermissionService.checkObjectAccess';
import checkFieldAccessApex from '@salesforce/apex/PermissionService.checkFieldAccess';
import hasCustomPermissionApex from '@salesforce/apex/PermissionService.hasCustomPermission';
import { getObjectAccess, getFieldAccess, hasCustomPermission, clearPermissionCache } from 'c/permissionUtils';

jest.mock('@salesforce/apex/PermissionService.checkObjectAccess', () => ({ default: jest.fn() }), {
    virtual: true
});
jest.mock('@salesforce/apex/PermissionService.checkFieldAccess', () => ({ default: jest.fn() }), {
    virtual: true
});
jest.mock('@salesforce/apex/PermissionService.hasCustomPermission', () => ({ default: jest.fn() }), {
    virtual: true
});

describe('permissionUtils', () => {
    beforeEach(() => {
        clearPermissionCache();
        jest.clearAllMocks();
    });

    it('getObjectAccess resolves with the Apex result', async () => {
        checkObjectAccessApex.mockResolvedValue({ isAccessible: true, isCreateable: false });

        const result = await getObjectAccess('Account');

        expect(result).toEqual({ isAccessible: true, isCreateable: false });
        expect(checkObjectAccessApex).toHaveBeenCalledWith({ objectApiName: 'Account' });
    });

    it('getObjectAccess only calls Apex once per object across repeated calls', async () => {
        checkObjectAccessApex.mockResolvedValue({ isAccessible: true });

        await getObjectAccess('Account');
        await getObjectAccess('Account');
        await getObjectAccess('Account');

        expect(checkObjectAccessApex).toHaveBeenCalledTimes(1);
    });

    it('getFieldAccess treats field order as irrelevant to the cache key', async () => {
        checkFieldAccessApex.mockResolvedValue([{ fieldName: 'Name', readable: true, editable: true }]);

        await getFieldAccess('Account', ['Name', 'Industry']);
        await getFieldAccess('Account', ['Industry', 'Name']);

        expect(checkFieldAccessApex).toHaveBeenCalledTimes(1);
        expect(checkFieldAccessApex).toHaveBeenCalledWith({ objectApiName: 'Account', fieldNames: ['Industry', 'Name'] });
    });

    it('hasCustomPermission memoizes by developer name', async () => {
        hasCustomPermissionApex.mockResolvedValue(true);

        const first = await hasCustomPermission('Toolkit_Bulk_Edit');
        const second = await hasCustomPermission('Toolkit_Bulk_Edit');

        expect(first).toBe(true);
        expect(second).toBe(true);
        expect(hasCustomPermissionApex).toHaveBeenCalledTimes(1);
    });

    it('evicts a failed call from the cache so a later call can retry', async () => {
        hasCustomPermissionApex.mockRejectedValueOnce(new Error('network error'));
        hasCustomPermissionApex.mockResolvedValueOnce(true);

        await expect(hasCustomPermission('Toolkit_Bulk_Edit')).rejects.toThrow('network error');
        const result = await hasCustomPermission('Toolkit_Bulk_Edit');

        expect(result).toBe(true);
        expect(hasCustomPermissionApex).toHaveBeenCalledTimes(2);
    });

    it('clearPermissionCache forces every cache to be reloaded', async () => {
        checkObjectAccessApex.mockResolvedValue({ isAccessible: true });

        await getObjectAccess('Account');
        clearPermissionCache();
        await getObjectAccess('Account');

        expect(checkObjectAccessApex).toHaveBeenCalledTimes(2);
    });
});
