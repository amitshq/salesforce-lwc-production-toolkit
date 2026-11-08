import { LightningElement, api } from 'lwc';
import getFilesForRecord from '@salesforce/apex/FileManagerService.getFilesForRecord';
import removeFileFromRecord from '@salesforce/apex/FileManagerService.removeFileFromRecord';
import { reduceApexErrors } from 'c/apexErrorUtils';
import { showSuccessToast, showErrorToast } from 'c/toastService';
import ConfirmDialog from 'c/confirmDialog';

const KB = 1024;
const MB = KB * 1024;

/**
 * Drop-in file manager for a record: upload (via the platform's own
 * lightning-file-upload), list what's already attached, and delete -
 * instead of re-wiring ContentDocumentLink queries per project.
 *
 * @example
 * <c-file-upload-manager record-id={recordId} accepted-formats={acceptedFormats}></c-file-upload-manager>
 */
export default class FileUploadManager extends LightningElement {
    @api recordId;
    @api label = 'Files';
    @api acceptedFormats = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.xlsx', '.csv', '.txt'];
    @api singleFileOnly = false;
    @api hideUploadArea = false;

    files = [];
    isLoading = false;
    hasError = false;
    errorMessage = '';

    connectedCallback() {
        this.loadFiles();
    }

    get isEmpty() {
        return !this.isLoading && !this.hasError && this.files.length === 0;
    }

    get multiple() {
        return !this.singleFileOnly;
    }

    loadFiles() {
        if (!this.recordId) {
            return;
        }
        this.isLoading = true;
        this.hasError = false;
        getFilesForRecord({ recordId: this.recordId })
            .then((results) => {
                this.files = results.map((file) => ({
                    ...file,
                    sizeLabel: formatFileSize(file.contentSize),
                    iconName: iconForExtension(file.fileExtension),
                    // Names the file, so a screen reader does not hear a list of identical "Remove" buttons.
                    removeLabel: `Remove ${file.title}`
                }));
            })
            .catch((error) => {
                this.hasError = true;
                this.errorMessage = reduceApexErrors(error).join(' ');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleUploadFinished(event) {
        const count = event.detail.files.length;
        showSuccessToast(this, `${count} file${count === 1 ? '' : 's'} uploaded.`);
        this.loadFiles();
    }

    // A file attached to other records too is only taken off this one; otherwise it is deleted.
    async handleDeleteClick(event) {
        const { id, title } = event.currentTarget.dataset;
        const confirmed = await ConfirmDialog.open({
            label: 'Remove File',
            message: `Remove "${title}" from this record? If it is not attached anywhere else, the file itself is deleted.`,
            variant: 'destructive',
            confirmLabel: 'Remove'
        });
        if (!confirmed) {
            return;
        }
        removeFileFromRecord({ contentDocumentId: id, recordId: this.recordId })
            .then((outcome) => {
                showSuccessToast(
                    this,
                    outcome === 'unlinked' ? `"${title}" removed from this record. It is still attached elsewhere.` : `"${title}" deleted.`
                );
                this.loadFiles();
            })
            .catch((error) => {
                showErrorToast(this, reduceApexErrors(error));
            });
    }

    @api
    refresh() {
        this.loadFiles();
    }
}

function formatFileSize(bytes) {
    if (bytes >= MB) {
        return `${(bytes / MB).toFixed(1)} MB`;
    }
    if (bytes >= KB) {
        return `${(bytes / KB).toFixed(1)} KB`;
    }
    return `${bytes} B`;
}

function iconForExtension(extension) {
    const ext = (extension || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return 'doctype:image';
    if (ext === 'pdf') return 'doctype:pdf';
    if (['doc', 'docx'].includes(ext)) return 'doctype:word';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'doctype:excel';
    if (['ppt', 'pptx'].includes(ext)) return 'doctype:ppt';
    return 'doctype:unknown';
}
