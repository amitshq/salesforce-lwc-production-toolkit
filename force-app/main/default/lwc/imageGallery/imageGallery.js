import { LightningElement, api } from 'lwc';

/**
 * Thumbnail grid with a click-to-enlarge lightbox (built on c-modal, with
 * Previous/Next navigation and keyboard arrow support). Takes plain
 * {url, title} data - pair it with FileManagerService.getFilesForRecord's
 * ContentVersion ids (rendered as
 * `/sfc/servlet.shepherd/version/download/{versionId}`) or any other image
 * source.
 *
 * @example
 * <c-image-gallery images={images}></c-image-gallery>
 *
 * // images = [{ url: '/path/to/img.jpg', title: 'Site photo 1' }, ...]
 */
export default class ImageGallery extends LightningElement {
    @api images = [];
    @api columns = 4;

    activeIndex = -1;
    _keydownBound = false;
    _boundHandleKeydown = this.handleLightboxKeydown.bind(this);

    renderedCallback() {
        if (this.isLightboxOpen && !this._keydownBound) {
            this._keydownBound = true;
            document.addEventListener('keydown', this._boundHandleKeydown);
        } else if (!this.isLightboxOpen && this._keydownBound) {
            this._keydownBound = false;
            document.removeEventListener('keydown', this._boundHandleKeydown);
        }
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this._boundHandleKeydown);
    }

    get isLightboxOpen() {
        return this.activeIndex >= 0 && this.activeIndex < this.images.length;
    }

    get activeImage() {
        return this.isLightboxOpen ? this.images[this.activeIndex] : null;
    }

    get activeImageTitle() {
        return this.activeImage ? this.activeImage.title : '';
    }

    get gridStyle() {
        return `grid-template-columns: repeat(${this.columns}, 1fr);`;
    }

    get counterLabel() {
        return this.isLightboxOpen ? `${this.activeIndex + 1} of ${this.images.length}` : '';
    }

    get isFirstImage() {
        return this.activeIndex <= 0;
    }

    get isLastImage() {
        return this.activeIndex >= this.images.length - 1;
    }

    handleThumbnailClick(event) {
        this.activeIndex = Number(event.currentTarget.dataset.index);
        const modal = this.template.querySelector('c-modal');
        if (modal) {
            modal.open();
        }
    }

    handleClose() {
        this.activeIndex = -1;
    }

    handlePrevious() {
        if (!this.isFirstImage) {
            this.activeIndex -= 1;
        }
    }

    handleNext() {
        if (!this.isLastImage) {
            this.activeIndex += 1;
        }
    }

    handleLightboxKeydown(event) {
        if (event.key === 'ArrowLeft') this.handlePrevious();
        if (event.key === 'ArrowRight') this.handleNext();
    }
}
