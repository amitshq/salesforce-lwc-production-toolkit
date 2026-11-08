import { createElement } from 'lwc';
import FileUploadManager from 'c/fileUploadManager';
import getFilesForRecord from '@salesforce/apex/FileManagerService.getFilesForRecord';
import removeFileFromRecord from '@salesforce/apex/FileManagerService.removeFileFromRecord';
import ConfirmDialog from 'c/confirmDialog';

jest.mock('@salesforce/apex/FileManagerService.getFilesForRecord', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/FileManagerService.removeFileFromRecord', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('c/confirmDialog', () => ({
    __esModule: true,
    default: { open: jest.fn(() => Promise.resolve(true)) }
}));

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createManager(props = {}) {
    const element = createElement('c-file-upload-manager', { is: FileUploadManager });
    element.recordId = '001000000000001';
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-file-upload-manager', () => {
    afterEach(() => {
        jest.clearAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('loads and renders files for the record on connect', async () => {
        getFilesForRecord.mockResolvedValue([
            { contentDocumentId: '0691', title: 'Contract.pdf', fileExtension: 'pdf', contentSize: 204800, createdDate: '2024-01-01T00:00:00Z' }
        ]);
        const element = createManager();
        await flushPromises();

        expect(getFilesForRecord).toHaveBeenCalledWith({ recordId: '001000000000001' });
        expect(element.shadowRoot.textContent).toContain('Contract.pdf');
        expect(element.shadowRoot.textContent).toContain('200.0 KB');
    });

    it('shows the empty state when there are no files', async () => {
        getFilesForRecord.mockResolvedValue([]);
        const element = createManager();
        await flushPromises();

        const stateManager = element.shadowRoot.querySelector('c-state-manager');
        expect(stateManager.shadowRoot.querySelector('c-empty-state')).not.toBeNull();
    });

    it('refreshes the list after a successful upload', async () => {
        getFilesForRecord.mockResolvedValue([]);
        const element = createManager();
        await flushPromises();
        getFilesForRecord.mockClear();

        getFilesForRecord.mockResolvedValue([
            { contentDocumentId: '0692', title: 'New.pdf', fileExtension: 'pdf', contentSize: 1024, createdDate: '2024-01-01T00:00:00Z' }
        ]);
        const uploader = element.shadowRoot.querySelector('lightning-file-upload');
        uploader.dispatchEvent(new CustomEvent('uploadfinished', { detail: { files: [{ name: 'New.pdf' }] } }));
        await flushPromises();

        expect(getFilesForRecord).toHaveBeenCalledTimes(1);
        expect(element.shadowRoot.textContent).toContain('New.pdf');
    });

    it('deletes a file after confirmation and refreshes', async () => {
        getFilesForRecord.mockResolvedValue([
            { contentDocumentId: '0691', title: 'Contract.pdf', fileExtension: 'pdf', contentSize: 1024, createdDate: '2024-01-01T00:00:00Z' }
        ]);
        removeFileFromRecord.mockResolvedValue('deleted');
        const element = createManager();
        await flushPromises();

        getFilesForRecord.mockResolvedValue([]);
        element.shadowRoot.querySelector('lightning-button-icon').click();
        await flushPromises();
        await flushPromises();

        expect(ConfirmDialog.open).toHaveBeenCalled();
        expect(removeFileFromRecord).toHaveBeenCalledWith({ contentDocumentId: '0691', recordId: '001000000000001' });
    });

    it('does not delete when the confirmation is dismissed', async () => {
        ConfirmDialog.open.mockResolvedValueOnce(false);
        getFilesForRecord.mockResolvedValue([
            { contentDocumentId: '0691', title: 'Contract.pdf', fileExtension: 'pdf', contentSize: 1024, createdDate: '2024-01-01T00:00:00Z' }
        ]);
        const element = createManager();
        await flushPromises();

        element.shadowRoot.querySelector('lightning-button-icon').click();
        await flushPromises();

        expect(removeFileFromRecord).not.toHaveBeenCalled();
    });

    describe('removing a file from this record', () => {
        // toastService skips a toast identical to one shown a moment ago, so each test uses its own file name.
        async function removeOnly(title, outcome) {
            getFilesForRecord.mockResolvedValue([
                { contentDocumentId: '0693', title, fileExtension: 'pdf', contentSize: 1024, createdDate: '2024-01-01T00:00:00Z' }
            ]);
            removeFileFromRecord.mockResolvedValue(outcome);
            const element = createManager();
            const toasts = [];
            element.addEventListener('lightning__showtoast', (event) => toasts.push(event.detail));
            await flushPromises();

            element.shadowRoot.querySelector('lightning-button-icon').click();
            await flushPromises();
            await flushPromises();
            return { element, toasts };
        }

        it('says the file is still attached elsewhere when it was only unlinked', async () => {
            const { toasts } = await removeOnly('Shared.pdf', 'unlinked');

            expect(toasts.map((toast) => toast.message)).toContain('"Shared.pdf" removed from this record. It is still attached elsewhere.');
        });

        it('says the file was deleted when this record was its only home', async () => {
            const { toasts } = await removeOnly('Solo.pdf', 'deleted');

            expect(toasts.map((toast) => toast.message)).toContain('"Solo.pdf" deleted.');
        });

        it('explains in the confirmation what will happen', async () => {
            await removeOnly('Explained.pdf', 'deleted');

            const { label, message, confirmLabel } = ConfirmDialog.open.mock.calls[0][0];
            expect(label).toBe('Remove File');
            expect(message).toContain('If it is not attached anywhere else, the file itself is deleted.');
            expect(confirmLabel).toBe('Remove');
        });

        it('names the file on each remove button for screen readers', async () => {
            const { element } = await removeOnly('Named.pdf', 'deleted');

            expect(element.shadowRoot.querySelector('lightning-button-icon').alternativeText).toBe('Remove Named.pdf');
        });

        it('reports a failure instead of claiming success', async () => {
            getFilesForRecord.mockResolvedValue([
                { contentDocumentId: '0694', title: 'Locked.pdf', fileExtension: 'pdf', contentSize: 1024, createdDate: '2024-01-01T00:00:00Z' }
            ]);
            removeFileFromRecord.mockRejectedValue({ body: { message: 'That file is not attached to this record.' } });
            const element = createManager();
            const toasts = [];
            element.addEventListener('lightning__showtoast', (event) => toasts.push(event.detail));
            await flushPromises();

            element.shadowRoot.querySelector('lightning-button-icon').click();
            await flushPromises();
            await flushPromises();

            expect(toasts.some((toast) => toast.variant === 'error')).toBe(true);
            expect(toasts.some((toast) => toast.variant === 'success')).toBe(false);
        });
    });
});
