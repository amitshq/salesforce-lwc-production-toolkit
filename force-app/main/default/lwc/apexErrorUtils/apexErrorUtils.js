/**
 * Turns the error thrown by an imperative `@salesforce/apex` call (or
 * surfaced by @wire to an Apex method) into plain, user-displayable
 * messages. Apex errors are shaped differently depending on how they
 * failed - a single AuraHandledException, a DML page/field error, a
 * network-level failure - this normalizes all of them.
 */

/**
 * @param {*} errors a single error, or an array of errors (as @wire gives for lists)
 * @returns {string[]} de-duplicated, human-readable messages, worst case ['Unknown error']
 */
export function reduceApexErrors(errors) {
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
export function reduceApexErrorMessage(errors, separator = ', ') {
    return reduceApexErrors(errors).join(separator);
}

function extractMessages(error) {
    // @wire to an imperative-style Apex method that returns a list can reject with an array in error.body.
    if (Array.isArray(error.body)) {
        return error.body.map((bodyItem) => bodyItem?.message).filter(Boolean);
    }
    // Page-level errors thrown from a DML operation inside Apex (Database.getErrors()-style).
    if (error.body?.pageErrors?.length) {
        return error.body.pageErrors.map((pageError) => pageError.message);
    }
    // Field-level errors, keyed by field API name.
    if (error.body?.fieldErrors && Object.keys(error.body.fieldErrors).length) {
        return Object.values(error.body.fieldErrors)
            .reduce((flat, fieldErrorList) => flat.concat(fieldErrorList), [])
            .map((fieldError) => fieldError.message);
    }
    // The common case: a single AuraHandledException/custom exception message.
    if (typeof error.body?.message === 'string') {
        return [error.body.message];
    }
    // A JS-level error (e.g. thrown before the request was sent).
    if (typeof error.message === 'string') {
        return [error.message];
    }
    // A raw network/transport failure.
    if (typeof error.statusText === 'string') {
        return [error.statusText];
    }
    return [];
}
