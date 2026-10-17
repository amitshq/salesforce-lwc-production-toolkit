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
    // True when the row was not saved because the record changed after the client loaded it.
    @AuraEnabled public Boolean isConflict = false;
    // New SystemModstamp (epoch ms) of a saved row. Only set when the caller asked for conflict checking.
    @AuraEnabled public Long modstamp;

    public DmlResult(String rowKey, String recordId, Boolean success, String message, List<String> fieldNames) {
        this.rowKey = rowKey;
        this.recordId = recordId;
        this.success = success;
        this.message = message;
        this.fieldNames = fieldNames;
    }
}
