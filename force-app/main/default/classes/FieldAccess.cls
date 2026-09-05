/**
 * FLS result for a single field, returned by PermissionService.checkFieldAccess().
 */
public with sharing class FieldAccess {
    @AuraEnabled public String fieldName;
    @AuraEnabled public Boolean readable;
    @AuraEnabled public Boolean editable;

    public FieldAccess(String fieldName, Boolean readable, Boolean editable) {
        this.fieldName = fieldName;
        this.readable = readable;
        this.editable = editable;
    }
}
