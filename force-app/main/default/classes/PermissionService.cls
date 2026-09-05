/**
 * Generic object/field/custom-permission checks so components don't hand-roll
 * describe calls (or bake permission-set-specific logic into every LWC).
 */
public with sharing class PermissionService {
    public class PermissionServiceException extends Exception {
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Boolean> checkObjectAccess(String objectApiName) {
        try {
            Schema.DescribeSObjectResult describe = describeObject(objectApiName);
            return new Map<String, Boolean>{
                'isAccessible' => describe.isAccessible(),
                'isCreateable' => describe.isCreateable(),
                'isUpdateable' => describe.isUpdateable(),
                'isDeletable' => describe.isDeletable()
            };
        } catch (PermissionServiceException pse) {
            throw new AuraHandledException(pse.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<FieldAccess> checkFieldAccess(String objectApiName, List<String> fieldNames) {
        try {
            Schema.DescribeSObjectResult describe = describeObject(objectApiName);
            Map<String, Schema.SObjectField> fieldMap = describe.fields.getMap();
            List<FieldAccess> results = new List<FieldAccess>();
            if (fieldNames == null) {
                return results;
            }
            for (String fieldName : fieldNames) {
                if (String.isBlank(fieldName)) {
                    continue;
                }
                Schema.SObjectField token = fieldMap.get(fieldName.trim().toLowerCase());
                if (token == null) {
                    results.add(new FieldAccess(fieldName, false, false));
                    continue;
                }
                Schema.DescribeFieldResult fieldDescribe = token.getDescribe();
                results.add(new FieldAccess(fieldDescribe.getName(), fieldDescribe.isAccessible(), fieldDescribe.isUpdateable()));
            }
            return results;
        } catch (PermissionServiceException pse) {
            throw new AuraHandledException(pse.getMessage());
        }
    }

    /**
     * True when the running user has the named Custom Permission, whether it
     * reached them directly or through a permission set / permission set
     * group / muting permission set assignment.
     */
    @AuraEnabled(cacheable=true)
    public static Boolean hasCustomPermission(String developerName) {
        try {
            if (String.isBlank(developerName)) {
                throw new PermissionServiceException('developerName is required.');
            }
            List<CustomPermission> permissions = [
                SELECT Id
                FROM CustomPermission
                WHERE DeveloperName = :developerName.trim()
                WITH USER_MODE
                LIMIT 1
            ];
            if (permissions.isEmpty()) {
                return false;
            }
            // SetupEntityAccess.ParentId always points at a PermissionSet - a
            // custom permission enabled directly on a Profile only shows up
            // there via that profile's own hidden, auto-generated
            // PermissionSet row, which PermissionSetAssignment never lists.
            // Both paths have to be checked to catch every way a user can
            // end up with this permission.
            Id currentUserProfileId = [SELECT ProfileId FROM User WHERE Id = :UserInfo.getUserId()].ProfileId;
            Integer assignmentCount = [
                SELECT COUNT()
                FROM SetupEntityAccess
                WHERE SetupEntityId = :permissions[0].Id
                AND (
                    ParentId IN (SELECT PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId = :UserInfo.getUserId())
                    OR ParentId IN (SELECT Id FROM PermissionSet WHERE ProfileId = :currentUserProfileId)
                )
            ];
            return assignmentCount > 0;
        } catch (PermissionServiceException pse) {
            throw new AuraHandledException(pse.getMessage());
        }
    }

    private static Schema.DescribeSObjectResult describeObject(String objectApiName) {
        if (String.isBlank(objectApiName)) {
            throw new PermissionServiceException('objectApiName is required.');
        }
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(objectApiName.trim());
        if (sObjectType == null) {
            throw new PermissionServiceException('Unknown object: ' + objectApiName);
        }
        return sObjectType.getDescribe();
    }
}
