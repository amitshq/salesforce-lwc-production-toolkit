/**
 * Generic Custom Metadata Type reader. Custom Metadata is the standard place
 * to park per-org/per-environment configuration (feature toggles, mapping
 * tables, thresholds) that admins should be able to change without a
 * deployment - this makes it available to any LWC with one cacheable call
 * instead of a bespoke wire method per metadata type.
 */
public with sharing class CustomMetadataService {
    public class CustomMetadataServiceException extends Exception {
    }

    @AuraEnabled(cacheable=true)
    public static List<SObject> getRecords(String metadataApiName, List<String> fieldNames) {
        try {
            Schema.DescribeSObjectResult describe = describeMetadataType(metadataApiName);
            Map<String, Schema.SObjectField> fieldMap = describe.fields.getMap();

            Set<String> safeFields = new Set<String>{ 'Id', 'DeveloperName', 'MasterLabel' };
            if (fieldNames != null) {
                for (String fieldName : fieldNames) {
                    if (String.isBlank(fieldName)) {
                        continue;
                    }
                    Schema.SObjectField token = fieldMap.get(fieldName.trim().toLowerCase());
                    if (token != null && token.getDescribe().isAccessible()) {
                        safeFields.add(token.getDescribe().getName());
                    }
                }
            }

            String query =
                'SELECT ' + String.join(new List<String>(safeFields), ', ') +
                ' FROM ' + describe.getName() +
                ' ORDER BY MasterLabel ASC';
            return Database.query(query, AccessLevel.USER_MODE);
        } catch (CustomMetadataServiceException cmse) {
            throw new AuraHandledException(cmse.getMessage());
        } catch (Exception e) {
            throw new AuraHandledException('Unable to load custom metadata: ' + e.getMessage());
        }
    }

    /** Convenience for a single record looked up by its DeveloperName. */
    @AuraEnabled(cacheable=true)
    public static SObject getRecordByDeveloperName(String metadataApiName, String developerName, List<String> fieldNames) {
        List<SObject> records = getRecords(metadataApiName, fieldNames);
        for (SObject record : records) {
            if (String.valueOf(record.get('DeveloperName')) == developerName) {
                return record;
            }
        }
        return null;
    }

    private static Schema.DescribeSObjectResult describeMetadataType(String metadataApiName) {
        if (String.isBlank(metadataApiName) || !metadataApiName.toLowerCase().endsWith('__mdt')) {
            throw new CustomMetadataServiceException('metadataApiName must be a Custom Metadata Type (end in __mdt).');
        }
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(metadataApiName.trim());
        if (sObjectType == null) {
            throw new CustomMetadataServiceException('Unknown custom metadata type: ' + metadataApiName);
        }
        return sObjectType.getDescribe();
    }
}
