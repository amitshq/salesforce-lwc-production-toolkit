/**
 * Turns errors from the Lightning Data Service / UI API wire adapters and
 * imperative functions (getRecord, createRecord, updateRecord,
 * deleteRecord, lightning-record-edit-form) into plain messages. LDS errors
 * nest page/field errors under `body.output`, which is a different shape
 * than a plain Apex exception - see apexErrorUtils for that case.
 */

/**
 * @param {*} errors a single error, or an array (as @wire gives for lists)
 * @returns {string[]} de-duplicated, human-readable messages, worst case ['Unknown error']
 */
export function reduceLdsErrors(errors) {
    const list = Array.isArray(errors) ? errors : [errors];
    const messages = list
        .filter((error) => !!error)
        .map((error) => extractMessages(error))
        .reduce((flat, messagesForError) => flat.concat(messagesForError), [])
        .filter((message) => !!message);

    return messages.length ? Array.from(new Set(messages)) : ['Unknown error'];
}

/**
 * @param {*} errors
 * @param {string} [separator]
 * @returns {string}
 */
export function reduceLdsErrorMessage(errors, separator = ', ') {
    return reduceLdsErrors(errors).join(separator);
}

function extractMessages(error) {
    const output = error.body?.output;

    if (output?.errors?.length) {
        return output.errors.map((pageError) => pageError.message);
    }
    if (output?.fieldErrors && Object.keys(output.fieldErrors).length) {
        return Object.values(output.fieldErrors)
            .reduce((flat, fieldErrorList) => flat.concat(fieldErrorList), [])
            .map((fieldError) => fieldError.message);
    }
    if (typeof error.body?.message === 'string') {
        return [error.body.message];
    }
    if (Array.isArray(error.body)) {
        return error.body.map((bodyItem) => bodyItem?.message).filter(Boolean);
    }
    if (typeof error.message === 'string') {
        return [error.message];
    }
    if (typeof error.statusText === 'string') {
        return [error.statusText];
    }
    return [];
}
