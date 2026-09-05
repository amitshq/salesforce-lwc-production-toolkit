@IsTest
private class PermissionServiceTest {
    @IsTest
    static void checksObjectAccessForKnownObject() {
        Test.startTest();
        Map<String, Boolean> access = PermissionService.checkObjectAccess('Account');
        Test.stopTest();

        System.assertEquals(true, access.get('isAccessible'));
        System.assertEquals(true, access.get('isCreateable'));
    }

    @IsTest
    static void checksFieldAccessAndFlagsUnknownFields() {
        Test.startTest();
        List<FieldAccess> results = PermissionService.checkFieldAccess(
            'Account',
            new List<String>{ 'Name', 'NotARealField__x' }
        );
        Test.stopTest();

        System.assertEquals(2, results.size());
        System.assertEquals(true, results[0].readable);
        System.assertEquals(false, results[1].readable);
        System.assertEquals(false, results[1].editable);
    }

    @IsTest
    static void hasCustomPermissionReturnsFalseWhenNotAssigned() {
        Test.startTest();
        Boolean assigned = PermissionService.hasCustomPermission('Toolkit_Bulk_Edit');
        Test.stopTest();

        System.assertEquals(false, assigned, 'The running test user has not been assigned this permission set.');
    }

    @IsTest
    static void throwsAuraHandledExceptionForUnknownObject() {
        Boolean threw = false;
        try {
            PermissionService.checkObjectAccess('NotAnObject__x');
        } catch (AuraHandledException ex) {
            threw = true;
        }
        System.assertEquals(true, threw);
    }
}
