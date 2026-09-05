@IsTest
private class GenericDmlServiceTest {
    @IsTest
    static void insertsNewRecordsAndReturnsGeneratedIds() {
        DmlRecordInput input = new DmlRecordInput('temp-1', new Map<String, Object>{ 'Name' => 'New From Toolkit' });

        Test.startTest();
        List<DmlResult> results = GenericDmlService.saveRecords('Account', new List<DmlRecordInput>{ input });
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals(true, results[0].success);
        System.assertEquals('temp-1', results[0].rowKey);
        System.assertNotEquals(null, results[0].recordId);

        Account created = [SELECT Name FROM Account WHERE Id = :results[0].recordId];
        System.assertEquals('New From Toolkit', created.Name);
    }

    @IsTest
    static void updatesExistingRecordByRowKey() {
        Account account = new Account(Name = 'Before Edit');
        insert account;

        DmlRecordInput input = new DmlRecordInput(
            account.Id,
            new Map<String, Object>{ 'Id' => account.Id, 'Name' => 'After Edit' }
        );

        Test.startTest();
        List<DmlResult> results = GenericDmlService.saveRecords('Account', new List<DmlRecordInput>{ input });
        Test.stopTest();

        System.assertEquals(true, results[0].success);
        System.assertEquals(account.Id, results[0].rowKey);
        System.assertEquals('After Edit', [SELECT Name FROM Account WHERE Id = :account.Id].Name);
    }

    @IsTest
    static void reportsPartialFailureWithoutBlockingOtherRows() {
        Account goodAccount = new Account(Name = 'Stays Good');
        insert goodAccount;
        Id missingId = '001000000000000AAA';

        List<DmlRecordInput> inputs = new List<DmlRecordInput>{
            new DmlRecordInput('good', new Map<String, Object>{ 'Id' => goodAccount.Id, 'Name' => 'Stays Good Updated' }),
            new DmlRecordInput('missing', new Map<String, Object>{ 'Id' => missingId, 'Name' => 'Will Not Save' })
        };

        Test.startTest();
        List<DmlResult> results = GenericDmlService.saveRecords('Account', inputs);
        Test.stopTest();

        Map<String, DmlResult> byRowKey = new Map<String, DmlResult>();
        for (DmlResult result : results) {
            byRowKey.put(result.rowKey, result);
        }

        System.assertEquals(true, byRowKey.get('good').success);
        System.assertEquals(false, byRowKey.get('missing').success);
        System.assertEquals('Stays Good Updated', [SELECT Name FROM Account WHERE Id = :goodAccount.Id].Name);
    }

    @IsTest
    static void reportsBuildErrorsForUnknownFieldsWithoutThrowing() {
        DmlRecordInput input = new DmlRecordInput('bad-field', new Map<String, Object>{ 'NotARealField__x' => 'value' });

        Test.startTest();
        List<DmlResult> results = GenericDmlService.saveRecords('Account', new List<DmlRecordInput>{ input });
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals(false, results[0].success);
        System.assertEquals('bad-field', results[0].rowKey);
    }

    @IsTest
    static void throwsAuraHandledExceptionForUnknownObject() {
        Boolean threw = false;
        try {
            GenericDmlService.saveRecords(
                'NotAnObject__x',
                new List<DmlRecordInput>{ new DmlRecordInput('x', new Map<String, Object>{ 'Name' => 'x' }) }
            );
        } catch (AuraHandledException ex) {
            threw = true;
        }
        System.assertEquals(true, threw);
    }

    @IsTest
    static void deletesRecordsAndReportsPartialFailure() {
        Account toDelete = new Account(Name = 'Delete Me');
        insert toDelete;
        Id missingId = '001000000000000AAA';

        Test.startTest();
        List<DmlResult> results = GenericDmlService.deleteRecords(
            'Account',
            new List<String>{ toDelete.Id, missingId }
        );
        Test.stopTest();

        Map<String, DmlResult> byRowKey = new Map<String, DmlResult>();
        for (DmlResult result : results) {
            byRowKey.put(result.rowKey, result);
        }

        System.assertEquals(true, byRowKey.get(toDelete.Id).success);
        System.assertEquals(false, byRowKey.get(String.valueOf(missingId)).success);
        System.assertEquals(0, [SELECT COUNT() FROM Account WHERE Id = :toDelete.Id]);
    }

    @IsTest
    static void deleteRecordsReportsInvalidIdWithoutThrowing() {
        Test.startTest();
        List<DmlResult> results = GenericDmlService.deleteRecords('Account', new List<String>{ 'not-an-id' });
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals(false, results[0].success);
    }
}
