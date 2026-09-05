/**
 * Per-row outcome from GenericDmlService.saveRecords(), so a batch save can
 * report partial success/failure back to the UI instead of all-or-nothing.
 */
public with sharing class DmlResult {
    @AuraEnabled public String rowKey;
    @AuraEnabled public String recordId;
    @AuraEnabled public Boolean success;
    @AuraEnabled public String message;
    @AuraEnabled public List<String> fieldNames;

    public DmlResult(String rowKey, String recordId, Boolean success, String message, List<String> fieldNames) {
        this.rowKey = rowKey;
        this.recordId = recordId;
        this.success = success;
        this.message = message;
        this.fieldNames = fieldNames;
    }
}
