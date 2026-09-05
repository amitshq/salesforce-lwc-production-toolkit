import LightningModal from 'lightning/modal';
import { api } from 'lwc';

/**
 * Promise-based confirmation dialog built on the standard `lightning/modal`
 * service, so callers get a plain await instead of wiring up open/close
 * events themselves.
 *
 * @example
 * import ConfirmDialog from 'c/confirmDialog';
 *
 * async handleDelete() {
 *     const confirmed = await ConfirmDialog.open({
 *         label: 'Delete Records',
 *         message: 'This will permanently delete 3 records. This cannot be undone.',
 *         variant: 'destructive',
 *         confirmLabel: 'Delete'
 *     });
 *     if (confirmed) {
 *         // proceed
 *     }
 * }
 */
export default class ConfirmDialog extends LightningModal {
    @api label = 'Confirm';
    @api message = 'Are you sure?';
    @api variant = 'neutral'; // 'neutral' | 'destructive'
    @api confirmLabel = 'Confirm';
    @api cancelLabel = 'Cancel';

    get confirmButtonVariant() {
        return this.variant === 'destructive' ? 'destructive' : 'brand';
    }

    handleCancel() {
        this.close(false);
    }

    handleConfirm() {
        this.close(true);
    }
}
