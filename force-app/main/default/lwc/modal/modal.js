import { LightningElement, api } from 'lwc';

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A declarative, composable modal for the common case LightningModal
 * doesn't cover well: content authored inline in a parent's template via
 * slots (a form, a multi-section panel, a wizard) rather than a fixed set
 * of @api properties passed to `.open()`. Renders hand-rolled SLDS modal
 * markup so it works anywhere a component can be placed - Experience
 * Cloud/LWR pages and older API versions included - not only where
 * `lightning/modal` is supported.
 *
 * @example
 * <c-modal header-label="Edit Contact" onclose={handleClose}>
 *     <div class="slds-p-around_medium">... body ...</div>
 *     <div slot="footer">
 *         <lightning-button label="Cancel" onclick={handleCancel}></lightning-button>
 *         <lightning-button label="Save" variant="brand" onclick={handleSave}></lightning-button>
 *     </div>
 * </c-modal>
 *
 * // In the parent, imperatively:
 * this.template.querySelector('c-modal').open();
 */
export default class Modal extends LightningElement {
    @api headerLabel = '';
    @api size = 'medium'; // 'small' | 'medium' | 'large' | 'full'
    @api preventCloseOnBackdropClick = false;
    @api hideCloseButton = false;

    isOpen = false;
    lastFocusedElement;
    boundHandleKeydown = this.handleKeydown.bind(this);

    get sectionClass() {
        const sizeClass =
            {
                small: 'slds-modal_small',
                medium: 'slds-modal_medium',
                large: 'slds-modal_large',
                full: 'slds-modal_full'
            }[this.size] || 'slds-modal_medium';
        return `slds-modal slds-fade-in-open ${sizeClass}`;
    }

    get headingId() {
        return `${this.uniqueId}-heading`;
    }

    get uniqueId() {
        if (!this._uniqueId) {
            this._uniqueId = `c-modal-${Math.random().toString(36).slice(2)}`;
        }
        return this._uniqueId;
    }

    @api
    open() {
        if (this.isOpen) {
            return;
        }
        this.lastFocusedElement = document.activeElement;
        this.isOpen = true;
        document.addEventListener('keydown', this.boundHandleKeydown);
        // Wait for the modal markup to render before moving focus into it.
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => this.focusFirstElement(), 0);
    }

    @api
    close() {
        if (!this.isOpen) {
            return;
        }
        this.isOpen = false;
        document.removeEventListener('keydown', this.boundHandleKeydown);
        if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
            this.lastFocusedElement.focus();
        }
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleCloseButtonClick() {
        this.close();
    }

    handleBackdropClick() {
        if (!this.preventCloseOnBackdropClick) {
            this.close();
        }
    }

    handleKeydown(event) {
        if (!this.isOpen) {
            return;
        }
        if (event.key === 'Escape') {
            this.close();
            return;
        }
        if (event.key === 'Tab') {
            this.trapFocus(event);
        }
    }

    trapFocus(event) {
        const focusable = this.getFocusableElements();
        if (!focusable.length) {
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeElement = this.template.activeElement;

        if (event.shiftKey && activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    focusFirstElement() {
        const [first] = this.getFocusableElements();
        if (first) {
            first.focus();
        }
    }

    getFocusableElements() {
        const container = this.template.querySelector('.slds-modal__container');
        return container ? Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)) : [];
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this.boundHandleKeydown);
    }
}
