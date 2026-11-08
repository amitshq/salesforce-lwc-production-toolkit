import { LightningElement, api } from 'lwc';
import saveRecords from '@salesforce/apex/GenericDmlService.saveRecords';
import validateRecords from '@salesforce/apex/GenericDmlService.validateRecords';
import { reduceApexErrors } from 'c/apexErrorUtils';
import { parseCsvTable, exportRowsToCsv } from 'c/csvUtils';
import { ID_FIELD, autoMapColumns, validateMapping, buildRecords } from 'c/csvImportEngine';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const SAMPLE_ROWS = 3;
const PREVIEW_ROWS = 5;
const MAX_LISTED_ERRORS = 10;

const STEPS = [
    { label: 'Upload', value: 'upload' },
    { label: 'Map columns', value: 'map' },
    { label: 'Review', value: 'review' },
    { label: 'Import', value: 'import' }
];

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('The file could not be read.'));
        reader.readAsText(file, 'UTF-8');
    });
}

function idleServerCheck() {
    return { status: 'idle', checked: 0, total: 0, failed: 0, message: '' };
}

function splitOutcomes(results) {
    const failures = [];
    let successCount = 0;
    results.forEach((outcome) => {
        if (outcome.success) {
            successCount++;
        } else {
            failures.push({
                rowNumber: Number(outcome.rowKey),
                fieldLabel: (outcome.fieldNames || []).join(', '),
                message: outcome.message || 'Unknown error'
            });
        }
    });
    return { successCount, failures };
}

/**
 * Upload a CSV, map its columns to fields, review what will happen, then
 * import it in chunks through GenericDmlService.saveRecords - so a bad row is
 * reported by row number instead of failing the whole file.
 *
 * Rows with a mapped Id update that record; rows without one create a new
 * record. Empty cells are never sent, so an update cannot blank a field by
 * accident. Each chunk is its own transaction: a large import is not
 * all-or-nothing, and a cancel stops after the chunk in flight.
 *
 * With `enable-server-check`, the review step can also check the rows against
 * Salesforce before importing: GenericDmlService.validateRecords saves each chunk
 * and rolls it back, so validation rules, required fields, duplicate rules and
 * automation all have their say. Rows that would fail join the problem list and
 * are skipped. It is off by default because the check runs triggers and flows, and
 * anything they do outside the database (emails, platform events, callouts) is not
 * rolled back. A passing row can still fail at import if the data changes first.
 *
 * @example
 * <c-csv-import-wizard
 *     object-api-name="Account"
 *     fields={fields}
 *     onimportcomplete={handleImportComplete}
 * ></c-csv-import-wizard>
 *
 * // fields = [
 * //     { apiName: 'Name', label: 'Account Name', type: 'text', required: true },
 * //     { apiName: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency' }
 * // ]
 */
export default class CsvImportWizard extends LightningElement {
    @api objectApiName;
    @api fields = [];
    @api chunkSize = 200;
    @api maxRows = 5000;
    @api enableServerCheck = false;

    step = 'upload';
    fileName = '';
    headers = [];
    rows = [];
    mapping = [];
    uploadError = '';
    mappingProblems = [];
    build = { records: [], errors: [], invalidRowCount: 0, emptyRowCount: 0 };
    progress = 0;
    cancelRequested = false;
    isImporting = false;
    result;
    serverFailures = [];
    serverCheck = idleServerCheck();

    @api
    reset() {
        this.step = 'upload';
        this.fileName = '';
        this.headers = [];
        this.rows = [];
        this.mapping = [];
        this.uploadError = '';
        this.mappingProblems = [];
        this.build = { records: [], errors: [], invalidRowCount: 0, emptyRowCount: 0 };
        this.progress = 0;
        this.cancelRequested = false;
        this.isImporting = false;
        this.result = undefined;
        this.serverFailures = [];
        this.serverCheck = idleServerCheck();
    }

    get steps() {
        return STEPS;
    }

    get indicatorStep() {
        return this.step === 'done' ? 'import' : this.step;
    }

    get isUploadStep() {
        return this.step === 'upload';
    }

    get isMapStep() {
        return this.step === 'map';
    }

    get isReviewStep() {
        return this.step === 'review';
    }

    get isImportStep() {
        return this.step === 'import';
    }

    get isDoneStep() {
        return this.step === 'done';
    }

    get hasUploadError() {
        return !!this.uploadError;
    }

    get hasMappingProblems() {
        return this.mappingProblems.length > 0;
    }

    get mappingOptions() {
        return [
            { label: 'Do not import', value: '' },
            { label: 'Id (update existing records)', value: ID_FIELD },
            ...this.fields.map((field) => ({
                label: `${field.label || field.apiName}${field.required ? ' *' : ''}`,
                value: field.apiName
            }))
        ];
    }

    get columnRows() {
        return this.headers.map((header, index) => ({
            key: `column-${index}`,
            index,
            header: header || `(column ${index + 1})`,
            sample: this.rows
                .slice(0, SAMPLE_ROWS)
                .map((cells) => cells[index])
                .filter((cell) => cell !== '')
                .join(' | '),
            value: this.mapping[index] || ''
        }));
    }

    get fileSummary() {
        return `${this.fileName}: ${this.rows.length} data row${this.rows.length === 1 ? '' : 's'}, ${this.headers.length} column${this.headers.length === 1 ? '' : 's'}`;
    }

    get mappedFieldNames() {
        return this.mapping.filter(Boolean);
    }

    get previewHeaders() {
        return this.mappedFieldNames.map((apiName) => ({
            key: apiName,
            label: apiName === ID_FIELD ? 'Id' : (this.fields.find((f) => f.apiName === apiName) || {}).label || apiName
        }));
    }

    get previewRows() {
        return this.build.records.slice(0, PREVIEW_ROWS).map((record) => ({
            rowNumber: record.rowNumber,
            cells: this.mappedFieldNames.map((apiName) => ({
                key: `${record.rowNumber}-${apiName}`,
                value: record.fields[apiName] === undefined ? '' : String(record.fields[apiName])
            }))
        }));
    }

    get updateCount() {
        return this.build.records.filter((record) => record.fields[ID_FIELD]).length;
    }

    get createCount() {
        return this.build.records.length - this.updateCount;
    }

    get reviewSummary() {
        const { records, invalidRowCount, emptyRowCount } = this.build;
        const parts = [
            `${this.createCount} to create`,
            `${this.updateCount} to update`,
            `${invalidRowCount} with problems (will be skipped)`
        ];
        if (emptyRowCount) {
            parts.push(`${emptyRowCount} blank (ignored)`);
        }
        return records.length || invalidRowCount ? parts.join(' • ') : 'There is nothing to import.';
    }

    get listedErrors() {
        return this.build.errors.slice(0, MAX_LISTED_ERRORS).map((error, index) => ({
            key: `error-${index}`,
            text: `Row ${error.rowNumber}${error.fieldLabel ? ` (${error.fieldLabel})` : ''}: ${error.message}`
        }));
    }

    get hasMoreErrors() {
        return this.build.errors.length > MAX_LISTED_ERRORS;
    }

    get moreErrorsText() {
        return `${this.build.errors.length - MAX_LISTED_ERRORS} more problems are in the error report.`;
    }

    get hasErrors() {
        return this.build.errors.length > 0;
    }

    get cannotImport() {
        return this.build.records.length === 0 || this.isCheckingServer;
    }

    get canCheckServer() {
        return this.enableServerCheck && this.build.records.length > 0 && this.serverCheck.status !== 'done';
    }

    get isCheckingServer() {
        return this.serverCheck.status === 'running';
    }

    get hasServerCheckResult() {
        return this.serverCheck.status !== 'idle';
    }

    get serverCheckButtonLabel() {
        return this.serverCheck.status === 'failed' ? 'Check again' : 'Check against Salesforce';
    }

    get serverCheckText() {
        const { status, checked, total, failed, message } = this.serverCheck;
        if (status === 'running') {
            return `Checking ${checked} of ${total} rows against Salesforce...`;
        }
        if (status === 'failed') {
            return `The check stopped after ${checked} of ${total} rows: ${message}`;
        }
        const rows = `${checked} row${checked === 1 ? '' : 's'}`;
        if (!failed) {
            return `Checked ${rows} against Salesforce: all would import.`;
        }
        return `Checked ${rows} against Salesforce: ${checked - failed} would import, ${failed} would fail and will be skipped (listed above).`;
    }

    get serverCheckClass() {
        const tone = this.serverCheck.status === 'failed' ? 'slds-text-color_error' : 'slds-text-color_weak';
        return `server-check-text slds-text-body_small slds-p-bottom_small ${tone}`;
    }

    get importButtonLabel() {
        const count = this.build.records.length;
        return `Import ${count} row${count === 1 ? '' : 's'}`;
    }

    get progressLabel() {
        return `${this.progress}%`;
    }

    get hasFailures() {
        return !!this.result && this.result.failureCount + this.result.validationFailureCount > 0;
    }

    get resultLines() {
        if (!this.result) {
            return [];
        }
        const { successCount, failureCount, validationFailureCount, notAttemptedCount } = this.result;
        const lines = [`${successCount} row${successCount === 1 ? '' : 's'} imported.`];
        if (failureCount) {
            lines.push(`${failureCount} row${failureCount === 1 ? '' : 's'} failed on the server.`);
        }
        if (validationFailureCount) {
            lines.push(`${validationFailureCount} row${validationFailureCount === 1 ? '' : 's'} skipped because of problems found before import.`);
        }
        if (notAttemptedCount) {
            lines.push(`${notAttemptedCount} row${notAttemptedCount === 1 ? '' : 's'} not imported because you cancelled.`);
        }
        return lines.map((text, index) => ({ key: `line-${index}`, text }));
    }

    async handleFileChange(event) {
        const file = event.target.files && event.target.files[0];
        this.uploadError = '';
        if (!file) {
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            this.uploadError = `That file is ${(file.size / (1024 * 1024)).toFixed(1)} MB; the limit is ${MAX_FILE_BYTES / (1024 * 1024)} MB.`;
            return;
        }
        try {
            const { headers, rows } = parseCsvTable(await readFileAsText(file));
            if (!rows.length) {
                this.uploadError = 'The file has a header row but no data rows.';
                return;
            }
            if (rows.length > this.maxRows) {
                this.uploadError = `The file has ${rows.length} rows; the limit is ${this.maxRows}. Split it into smaller files.`;
                return;
            }
            this.fileName = file.name;
            this.headers = headers;
            this.rows = rows;
            this.mapping = autoMapColumns(headers, this.fields);
            this.mappingProblems = [];
            this.step = 'map';
        } catch (error) {
            this.uploadError = error.message;
        }
    }

    handleMappingChange(event) {
        const index = Number(event.currentTarget.dataset.index);
        const next = [...this.mapping];
        next[index] = event.detail.value;
        this.mapping = next;
        this.mappingProblems = [];
    }

    handleBackToUpload() {
        this.reset();
    }

    handleMapNext() {
        this.mappingProblems = validateMapping(this.mapping, this.fields);
        if (this.mappingProblems.length) {
            return;
        }
        this.build = buildRecords({ rows: this.rows, mapping: this.mapping, fields: this.fields });
        this.serverCheck = idleServerCheck();
        this.step = 'review';
    }

    /**
     * Saves the rows chunk by chunk and rolls each chunk back, then moves the rows
     * Salesforce rejected from the import into the problem list. If a chunk cannot be
     * checked at all, the rows checked so far keep their results; the rest stay in the
     * import unchecked, and the user can check again.
     */
    async handleServerCheck() {
        const records = this.build.records;
        const size = Math.max(1, Number(this.chunkSize) || 200);
        const rejected = new Map();
        let checked = 0;
        let message = '';
        this.serverCheck = { status: 'running', checked: 0, total: records.length, failed: 0, message: '' };

        for (let start = 0; start < records.length; start += size) {
            const chunk = records.slice(start, start + size);
            try {
                // One chunk at a time, like the import itself.
                // eslint-disable-next-line no-await-in-loop
                const results = await validateRecords({
                    objectApiName: this.objectApiName,
                    records: chunk.map((record) => ({ rowKey: String(record.rowNumber), fields: record.fields }))
                });
                results.filter((outcome) => !outcome.success).forEach((outcome) => rejected.set(Number(outcome.rowKey), outcome));
            } catch (error) {
                message = reduceApexErrors(error).join(' ');
                break;
            }
            checked += chunk.length;
            this.serverCheck = { ...this.serverCheck, checked };
        }

        const newErrors = [];
        rejected.forEach((outcome, rowNumber) => {
            newErrors.push({
                rowNumber,
                fieldLabel: (outcome.fieldNames || []).join(', '),
                message: outcome.message || 'Salesforce would not save this row.'
            });
        });
        this.build = {
            ...this.build,
            records: records.filter((record) => !rejected.has(record.rowNumber)),
            errors: [...this.build.errors, ...newErrors].sort((a, b) => a.rowNumber - b.rowNumber),
            invalidRowCount: this.build.invalidRowCount + rejected.size
        };
        this.serverCheck = { status: message ? 'failed' : 'done', checked, total: records.length, failed: rejected.size, message };
    }

    handleReviewBack() {
        this.step = 'map';
    }

    async handleStartImport() {
        const records = this.build.records;
        const size = Math.max(1, Number(this.chunkSize) || 200);
        const failures = [];
        let successCount = 0;
        let attempted = 0;

        this.step = 'import';
        this.isImporting = true;
        this.cancelRequested = false;
        this.progress = 0;

        for (let start = 0; start < records.length; start += size) {
            if (this.cancelRequested) {
                break;
            }
            const chunk = records.slice(start, start + size);
            try {
                // Chunks run one after another on purpose: each is its own transaction, and
                // running them in parallel would multiply DML load and break cancelling.
                // eslint-disable-next-line no-await-in-loop
                const results = await saveRecords({
                    objectApiName: this.objectApiName,
                    records: chunk.map((record) => ({ rowKey: String(record.rowNumber), fields: record.fields }))
                });
                const outcome = splitOutcomes(results);
                successCount += outcome.successCount;
                failures.push(...outcome.failures);
            } catch (error) {
                const message = reduceApexErrors(error).join(' ');
                chunk.forEach((record) => failures.push({ rowNumber: record.rowNumber, fieldLabel: '', message }));
            }
            attempted += chunk.length;
            this.progress = Math.round((attempted / records.length) * 100);
        }

        this.serverFailures = failures;
        this.result = {
            successCount,
            failureCount: failures.length,
            validationFailureCount: this.build.invalidRowCount,
            notAttemptedCount: records.length - attempted,
            emptyRowCount: this.build.emptyRowCount
        };
        this.isImporting = false;
        this.step = 'done';
        this.dispatchEvent(new CustomEvent('importcomplete', { detail: { ...this.result } }));
    }

    handleCancelImport() {
        this.cancelRequested = true;
    }

    handleDownloadErrors() {
        const rows = [...this.build.errors, ...this.serverFailures]
            .sort((a, b) => a.rowNumber - b.rowNumber)
            .map((error) => ({ Row: error.rowNumber, Field: error.fieldLabel, Message: error.message }));
        exportRowsToCsv(rows, ['Row', 'Field', 'Message'], 'import-errors.csv');
    }

    handleImportAnother() {
        this.reset();
    }
}
