@IsTest
private class CustomMetadataServiceTest {
    @IsTest
    static void loadsDeployedDefaultRecord() {
        Test.startTest();
        List<SObject> records = CustomMetadataService.getRecords(
            'ToolkitDemoSetting__mdt',
            new List<String>{ 'IsEnabled__c', 'Description__c', 'DefaultPageSize__c' }
        );
        Test.stopTest();

        System.assertEquals(true, records.size() >= 1, 'The Default custom metadata record ships with the package.');

        SObject defaultRecord = CustomMetadataService.getRecordByDeveloperName(
            'ToolkitDemoSetting__mdt',
            'Default',
            new List<String>{ 'IsEnabled__c', 'DefaultPageSize__c' }
        );
        System.assertNotEquals(null, defaultRecord);
        System.assertEquals(true, (Boolean) defaultRecord.get('IsEnabled__c'));
    }

    @IsTest
    static void rejectsNonMetadataObjects() {
        Boolean threw = false;
        try {
            CustomMetadataService.getRecords('Account', new List<String>{ 'Name' });
        } catch (AuraHandledException ex) {
            threw = true;
        }
        System.assertEquals(true, threw, 'Only __mdt objects are valid input.');
    }

    @IsTest
    static void rejectsUnknownMetadataType() {
        Boolean threw = false;
        try {
            CustomMetadataService.getRecords('NotReal__mdt', new List<String>{ 'Name' });
        } catch (AuraHandledException ex) {
            threw = true;
        }
        System.assertEquals(true, threw);
    }
}
