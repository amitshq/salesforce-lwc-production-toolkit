/**
 * One row submitted to GenericDmlService.saveRecords().
 * rowKey lets the client correlate a DmlResult back to a UI row even for
 * inserts, where no Id exists until after the DML runs.
 */
public with sharing class DmlRecordInput {
    @AuraEnabled public String rowKey;
    @AuraEnabled public Map<String, Object> fields;

    public DmlRecordInput() {
    }

    public DmlRecordInput(String rowKey, Map<String, Object> fields) {
        this.rowKey = rowKey;
        this.fields = fields;
    }
}
