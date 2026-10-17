/**
 * One row submitted to GenericDmlService.saveRecords().
 * rowKey lets the client correlate a DmlResult back to a UI row even for
 * inserts, where no Id exists until after the DML runs.
 *
 * expectedModstamp (optional, updates only) is the record's SystemModstamp,
 * in epoch milliseconds, as it was when the client loaded the row. When set,
 * the save is rejected if the record has changed since.
 */
public with sharing class DmlRecordInput {
    @AuraEnabled public String rowKey;
    @AuraEnabled public Map<String, Object> fields;
    @AuraEnabled public Long expectedModstamp;

    public DmlRecordInput() {
    }

    public DmlRecordInput(String rowKey, Map<String, Object> fields) {
        this.rowKey = rowKey;
        this.fields = fields;
    }
}
