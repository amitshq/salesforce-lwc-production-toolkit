/**
 * Generic bulk save (insert or update) for any sObject, used by
 * c-enterprise-datatable's inline-edit and bulk-action pipelines.
 *
 * Runs with allOrNone=false so one bad row never blocks the rest, and
 * returns a DmlResult per input row (correlated by rowKey) so the caller
 * can surface partial errors instead of a single opaque failure.
 *
 * Field-level security is enforced with Security.stripInaccessible rather
 * than a manual per-field describe check, since it is the platform's
 * purpose-built API for exactly this "dynamic map of fields" scenario.
 */
public with sharing class GenericDmlService {
    public class DmlServiceException extends Exception {
    }

    @AuraEnabled
    public static List<DmlResult> saveRecords(String objectApiName, List<DmlRecordInput> records) {
        List<DmlResult> results = new List<DmlResult>();
        try {
            Schema.SObjectType sObjectType = describeObjectType(objectApiName);
            if (records == null || records.isEmpty()) {
                return results;
            }

            List<SObject> toInsert = new List<SObject>();
            List<String> toInsertKeys = new List<String>();
            List<SObject> toUpdate = new List<SObject>();
            List<String> toUpdateKeys = new List<String>();

            for (DmlRecordInput input : records) {
                String rowKey = input?.rowKey;
                try {
                    SObject record = buildSObject(sObjectType, objectApiName, input?.fields);
                    Id existingId = (Id) record.get('Id');
                    if (existingId != null) {
                        toUpdate.add(record);
                        toUpdateKeys.add(rowKey);
                    } else {
                        toInsert.add(record);
                        toInsertKeys.add(rowKey);
                    }
                } catch (Exception buildError) {
                    results.add(new DmlResult(rowKey, null, false, 'Invalid field data: ' + buildError.getMessage(), null));
                }
            }

            if (!toInsert.isEmpty()) {
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, toInsert);
                results.addAll(runDml(decision.getRecords(), toInsertKeys, true));
            }
            if (!toUpdate.isEmpty()) {
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, toUpdate);
                results.addAll(runDml(decision.getRecords(), toUpdateKeys, false));
            }

            return results;
        } catch (DmlServiceException dse) {
            throw new AuraHandledException(dse.getMessage());
        } catch (Exception e) {
            throw new AuraHandledException('Unable to save records: ' + e.getMessage());
        }
    }

    /**
     * Bulk delete with the same partial-success contract as saveRecords, so
     * a bulk-delete action in c-enterprise-datatable can report exactly
     * which rows failed (e.g. a lookup restriction) instead of aborting
     * the whole batch.
     */
    @AuraEnabled
    public static List<DmlResult> deleteRecords(String objectApiName, List<String> recordIds) {
        List<DmlResult> results = new List<DmlResult>();
        try {
            describeObjectType(objectApiName);
            if (recordIds == null || recordIds.isEmpty()) {
                return results;
            }

            List<Id> ids = new List<Id>();
            List<String> validRowKeys = new List<String>();
            for (String recordId : recordIds) {
                try {
                    ids.add((Id) recordId);
                    validRowKeys.add(recordId);
                } catch (Exception castError) {
                    results.add(new DmlResult(recordId, null, false, 'Invalid record Id: ' + recordId, null));
                }
            }
            if (ids.isEmpty()) {
                return results;
            }

            List<Database.DeleteResult> deleteResults = Database.delete(ids, false, AccessLevel.USER_MODE);
            for (Integer i = 0; i < deleteResults.size(); i++) {
                Database.DeleteResult deleteResult = deleteResults[i];
                String rowKey = validRowKeys[i];
                if (deleteResult.isSuccess()) {
                    results.add(new DmlResult(rowKey, deleteResult.getId(), true, null, null));
                } else {
                    List<String> messages = new List<String>();
                    for (Database.Error dmlError : deleteResult.getErrors()) {
                        messages.add(dmlError.getMessage());
                    }
                    results.add(new DmlResult(rowKey, null, false, String.join(messages, ' '), null));
                }
            }
            return results;
        } catch (DmlServiceException dse) {
            throw new AuraHandledException(dse.getMessage());
        } catch (Exception e) {
            throw new AuraHandledException('Unable to delete records: ' + e.getMessage());
        }
    }

    private static List<DmlResult> runDml(List<SObject> sObjects, List<String> rowKeys, Boolean isInsert) {
        List<DmlResult> results = new List<DmlResult>();
        if (sObjects.isEmpty()) {
            return results;
        }
        List<Database.SaveResult> saveResults = isInsert
            ? Database.insert(sObjects, false, AccessLevel.USER_MODE)
            : Database.update(sObjects, false, AccessLevel.USER_MODE);

        for (Integer i = 0; i < saveResults.size(); i++) {
            Database.SaveResult saveResult = saveResults[i];
            String rowKey = rowKeys[i];
            if (saveResult.isSuccess()) {
                results.add(new DmlResult(rowKey, saveResult.getId(), true, null, null));
            } else {
                List<String> messages = new List<String>();
                List<String> fieldNames = new List<String>();
                for (Database.Error dmlError : saveResult.getErrors()) {
                    messages.add(dmlError.getMessage());
                    if (dmlError.getFields() != null) {
                        fieldNames.addAll(dmlError.getFields());
                    }
                }
                results.add(new DmlResult(rowKey, null, false, String.join(messages, ' '), fieldNames));
            }
        }
        return results;
    }

    private static Schema.SObjectType describeObjectType(String objectApiName) {
        if (String.isBlank(objectApiName)) {
            throw new DmlServiceException('objectApiName is required.');
        }
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(objectApiName.trim());
        if (sObjectType == null) {
            throw new DmlServiceException('Unknown object: ' + objectApiName);
        }
        return sObjectType;
    }

    private static SObject buildSObject(Schema.SObjectType sObjectType, String objectApiName, Map<String, Object> fields) {
        if (fields == null || fields.isEmpty()) {
            throw new DmlServiceException('No field values supplied.');
        }
        Map<String, Object> payload = new Map<String, Object>(fields);
        payload.put('attributes', new Map<String, String>{ 'type' => objectApiName });
        return (SObject) JSON.deserialize(JSON.serialize(payload), SObject.class);
    }
}
