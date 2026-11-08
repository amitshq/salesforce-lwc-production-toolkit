import { LightningElement, api } from 'lwc';

// Native controls plus the base components that take focus. `disabled` is checked as a property
// below, because on base components it is not a reflected attribute.
const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button',
    'textarea',
    'input',
    'select',
    '[tabindex]:not([tabindex="-1"])',
    'lightning-button',
    'lightning-button-icon',
    'lightning-button-menu',
    'lightning-input',
    'lightning-combobox',
    'lightning-textarea',
    'lightning-checkbox-group',
    'lightning-radio-group',
    'lightning-dual-listbox',
    'lightning-record-picker'
].join(', ');

/** The element that really has focus, looking through shadow roots (document.activeElement stops at the host). */
function getDeepActiveElement() {
    let active = document.activeElement;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
        active = active.shadowRoot.activeElement;
    }
    return active;
}

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
        this.lastFocusedElement = getDeepActiveElement();
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
        if (this.isOpen && event.key === 'Escape') {
            this.close();
        }
    }

    /*
     * Focus is kept inside by two invisible guards around the dialog, not by intercepting Tab.
     * Tab moves through everything in its natural order - the close button, the slotted body and
     * footer, even controls inside nested components - and only when it runs off an edge does it
     * land on a guard, which sends it round to the other end. The old Tab handler only looked in
     * this component's own markup, never saw the slotted content, and trapped keyboard users on
     * the close button.
     */
    handleStartGuardFocus() {
        const focusable = this.getFocusableElements();
        this.focusOrDialog(focusable[focusable.length - 1]);
    }

    handleEndGuardFocus() {
        this.focusOrDialog(this.getFocusableElements()[0]);
    }

    focusFirstElement() {
        this.focusOrDialog(this.getFocusableElements()[0]);
    }

    // With nothing focusable inside, the dialog itself takes focus, so keyboard users are still in it.
    focusOrDialog(element) {
        const target = element || this.template.querySelector('section[role="dialog"]');
        if (target) {
            target.focus();
        }
    }

    /** In tab order: this component's own controls (the close button), then the slotted body, then the footer. */
    getFocusableElements() {
        const container = this.template.querySelector('.slds-modal__container');
        if (!container) {
            return [];
        }
        const own = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
        // Slotted content belongs to this component's light DOM, which the shadow-tree query above never sees.
        const slotted = Array.from(this.querySelectorAll(FOCUSABLE_SELECTOR));
        const inFooter = (element) => !!element.closest('[slot="footer"]');
        return [...own, ...slotted.filter((element) => !inFooter(element)), ...slotted.filter(inFooter)].filter(
            (element) => !element.disabled && !element.closest('[hidden]')
        );
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this.boundHandleKeydown);
    }
}
