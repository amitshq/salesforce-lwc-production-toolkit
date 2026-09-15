import { createElement } from 'lwc';
import ImageGallery from 'c/imageGallery';

const IMAGES = [
    { url: '/img/one.jpg', title: 'One' },
    { url: '/img/two.jpg', title: 'Two' },
    { url: '/img/three.jpg', title: 'Three' }
];

function createGallery(props = {}) {
    const element = createElement('c-image-gallery', { is: ImageGallery });
    element.images = IMAGES;
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-image-gallery', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders one thumbnail per image', () => {
        const element = createGallery();
        expect(element.shadowRoot.querySelectorAll('.gallery-thumb')).toHaveLength(3);
    });

    it('clicking a thumbnail opens the lightbox on that image', () => {
        const element = createGallery();
        element.shadowRoot.querySelectorAll('.gallery-thumb')[1].click();

        return Promise.resolve().then(() => {
            const lightboxImage = element.shadowRoot.querySelector('.lightbox-image');
            expect(lightboxImage.src).toContain('/img/two.jpg');
            expect(element.shadowRoot.textContent).toContain('2 of 3');
        });
    });

    it('Previous/Next move through the images and disable at the ends', () => {
        const element = createGallery();
        element.shadowRoot.querySelectorAll('.gallery-thumb')[0].click();

        return Promise.resolve().then(() => {
            const [previousBtn, nextBtn] = element.shadowRoot.querySelectorAll('lightning-button');
            expect(previousBtn.disabled).toBe(true);

            nextBtn.click();
            return Promise.resolve().then(() => {
                expect(element.shadowRoot.querySelector('.lightbox-image').src).toContain('/img/two.jpg');
                expect(previousBtn.disabled).toBe(false);
                expect(nextBtn.disabled).toBe(false);
            });
        });
    });

    it('closing the modal clears the lightbox', () => {
        const element = createGallery();
        element.shadowRoot.querySelectorAll('.gallery-thumb')[0].click();

        return Promise.resolve().then(() => {
            element.shadowRoot.querySelector('c-modal').dispatchEvent(new CustomEvent('close'));
            return Promise.resolve().then(() => {
                expect(element.shadowRoot.querySelector('.lightbox-image')).toBeNull();
            });
        });
    });
});
