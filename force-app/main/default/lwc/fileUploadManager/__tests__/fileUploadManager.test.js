import { createElement } from 'lwc';
import FileUploadManager from 'c/fileUploadManager';
import getFilesForRecord from '@salesforce/apex/FileManagerService.getFilesForRecord';
import deleteFile from '@salesforce/apex/FileManagerService.deleteFile';
import ConfirmDialog from 'c/confirmDialog';

jest.mock('@salesforce/apex/FileManagerService.getFilesForRecord', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/FileManagerService.deleteFile', () => ({ default: jest.fn() }), { virtual: true });
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
        deleteFile.mockResolvedValue();
        const element = createManager();
        await flushPromises();

        getFilesForRecord.mockResolvedValue([]);
        element.shadowRoot.querySelector('lightning-button-icon').click();
        await flushPromises();
        await flushPromises();

        expect(ConfirmDialog.open).toHaveBeenCalled();
        expect(deleteFile).toHaveBeenCalledWith({ contentDocumentId: '0691' });
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

        expect(deleteFile).not.toHaveBeenCalled();
    });
});
