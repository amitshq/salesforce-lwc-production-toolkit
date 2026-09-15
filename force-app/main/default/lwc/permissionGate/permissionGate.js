import { LightningElement, api } from 'lwc';
import { getObjectAccess, getFieldAccess, hasCustomPermission } from 'c/permissionUtils';

/**
 * Declaratively gates slotted content behind an object/field/custom
 * permission check, instead of every consumer wiring permissionUtils and a
 * v-if by hand. All checks provided are AND'd together.
 *
 * This only hides/shows UI - it is not the security boundary. The real
 * enforcement is server-side (Security.stripInaccessible,
 * AccessLevel.USER_MODE in the Apex services); this component exists so
 * users don't see controls they can't use, not to keep data from them.
 *
 * @example
 * <c-permission-gate object-api-name="Account" required-access="delete">
 *     <lightning-button label="Delete" variant="destructive"></lightning-button>
 *     <div slot="noaccess">You don't have permission to delete accounts.</div>
 * </c-permission-gate>
 *
 * <c-permission-gate custom-permission="Toolkit_Bulk_Edit">
 *     <c-bulk-action-bar ...></c-bulk-action-bar>
 * </c-permission-gate>
 */
export default class PermissionGate extends LightningElement {
    @api objectApiName;
    @api requiredAccess = 'read'; // 'read' | 'create' | 'edit' | 'delete'
    @api fieldApiName;
    @api customPermission;

    isLoading = true;
    hasAccess = false;

    connectedCallback() {
        const checks = [];
        if (this.objectApiName) {
            checks.push(this.checkObjectAccess());
        }
        if (this.objectApiName && this.fieldApiName) {
            checks.push(this.checkFieldAccess());
        }
        if (this.customPermission) {
            checks.push(hasCustomPermission(this.customPermission));
        }

        if (!checks.length) {
            this.isLoading = false;
            this.hasAccess = true;
            return;
        }

        Promise.all(checks)
            .then((results) => {
                this.hasAccess = results.every(Boolean);
            })
            .catch(() => {
                this.hasAccess = false;
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    checkObjectAccess() {
        const accessKey = { read: 'isAccessible', create: 'isCreateable', edit: 'isUpdateable', delete: 'isDeletable' }[
            this.requiredAccess
        ];
        return getObjectAccess(this.objectApiName).then((access) => !!access[accessKey]);
    }

    checkFieldAccess() {
        return getFieldAccess(this.objectApiName, [this.fieldApiName]).then((results) => {
            const fieldResult = results[0];
            if (!fieldResult) return false;
            return this.requiredAccess === 'edit' ? fieldResult.editable : fieldResult.readable;
        });
    }

    get showContent() {
        return !this.isLoading && this.hasAccess;
    }

    get showNoAccess() {
        return !this.isLoading && !this.hasAccess;
    }
}
