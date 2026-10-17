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

        System.assertEquals(true, byRowKey.get(String.valueOf(toDelete.Id)).success);
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

    @IsTest
    static void rejectsAnUpdateWhenTheRecordChangedSinceItWasLoaded() {
        Account account = new Account(Name = 'Original');
        insert account;
        Long currentStamp = [SELECT SystemModstamp FROM Account WHERE Id = :account.Id].SystemModstamp.getTime();

        DmlRecordInput input = new DmlRecordInput(account.Id, new Map<String, Object>{ 'Id' => account.Id, 'Name' => 'Stale Edit' });
        input.expectedModstamp = currentStamp - 60000;

        Test.startTest();
        List<DmlResult> results = GenericDmlService.saveRecords('Account', new List<DmlRecordInput>{ input });
        Test.stopTest();

        System.assertEquals(false, results[0].success);
        System.assertEquals(true, results[0].isConflict);
        System.assertEquals('Original', [SELECT Name FROM Account WHERE Id = :account.Id].Name, 'The stale edit must not be applied.');
    }

    @IsTest
    static void appliesAnUpdateWhenTheLoadedVersionIsStillCurrent() {
        Account account = new Account(Name = 'Original');
        insert account;
        Long currentStamp = [SELECT SystemModstamp FROM Account WHERE Id = :account.Id].SystemModstamp.getTime();

        DmlRecordInput input = new DmlRecordInput(account.Id, new Map<String, Object>{ 'Id' => account.Id, 'Name' => 'Fresh Edit' });
        input.expectedModstamp = currentStamp;

        Test.startTest();
        List<DmlResult> results = GenericDmlService.saveRecords('Account', new List<DmlRecordInput>{ input });
        Test.stopTest();

        System.assertEquals(true, results[0].success);
        System.assertEquals(false, results[0].isConflict);
        System.assertNotEquals(null, results[0].modstamp, 'A checked save returns the record\'s new modstamp for the next edit.');
        System.assertEquals('Fresh Edit', [SELECT Name FROM Account WHERE Id = :account.Id].Name);
    }

    @IsTest
    static void conflictCheckingIsSkippedWhenNoExpectedModstampIsGiven() {
        Account account = new Account(Name = 'Original');
        insert account;

        DmlRecordInput input = new DmlRecordInput(account.Id, new Map<String, Object>{ 'Id' => account.Id, 'Name' => 'Unchecked Edit' });

        Test.startTest();
        List<DmlResult> results = GenericDmlService.saveRecords('Account', new List<DmlRecordInput>{ input });
        Test.stopTest();

        System.assertEquals(true, results[0].success);
        System.assertEquals(null, results[0].modstamp, 'No extra query or modstamp when conflict checking was not requested.');
    }

    @IsTest
    static void aConflictOnOneRowDoesNotBlockTheOthers() {
        Account stale = new Account(Name = 'Stale Row');
        Account fine = new Account(Name = 'Fine Row');
        insert new List<Account>{ stale, fine };
        Long staleStamp = [SELECT SystemModstamp FROM Account WHERE Id = :stale.Id].SystemModstamp.getTime() - 60000;
        Long fineStamp = [SELECT SystemModstamp FROM Account WHERE Id = :fine.Id].SystemModstamp.getTime();

        DmlRecordInput staleInput = new DmlRecordInput(stale.Id, new Map<String, Object>{ 'Id' => stale.Id, 'Name' => 'Stale Edit' });
        staleInput.expectedModstamp = staleStamp;
        DmlRecordInput fineInput = new DmlRecordInput(fine.Id, new Map<String, Object>{ 'Id' => fine.Id, 'Name' => 'Fine Edit' });
        fineInput.expectedModstamp = fineStamp;

        Test.startTest();
        List<DmlResult> results = GenericDmlService.saveRecords('Account', new List<DmlRecordInput>{ staleInput, fineInput });
        Test.stopTest();

        Map<String, DmlResult> byRowKey = new Map<String, DmlResult>();
        for (DmlResult result : results) {
            byRowKey.put(result.rowKey, result);
        }
        System.assertEquals(true, byRowKey.get(String.valueOf(stale.Id)).isConflict);
        System.assertEquals(true, byRowKey.get(String.valueOf(fine.Id)).success);
        System.assertEquals('Fine Edit', [SELECT Name FROM Account WHERE Id = :fine.Id].Name);
    }
}
