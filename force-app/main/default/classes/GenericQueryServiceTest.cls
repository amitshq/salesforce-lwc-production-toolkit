@IsTest
private class GenericQueryServiceTest {
    @TestSetup
    static void setup() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 5; i++) {
            accounts.add(new Account(Name = 'Toolkit Test ' + i, Industry = (Math.mod(i, 2) == 0 ? 'Technology' : 'Banking')));
        }
        insert accounts;
    }

    @IsTest
    static void returnsPagedFilteredAndSortedResults() {
        List<QueryFilter> filters = new List<QueryFilter>{ new QueryFilter('Industry', '=', 'Technology') };

        Test.startTest();
        QueryResult result = GenericQueryService.query(
            'Account',
            new List<String>{ 'Name', 'Industry' },
            filters,
            'Name',
            'ASC',
            null,
            null,
            1,
            2
        );
        Test.stopTest();

        System.assertEquals(3, result.totalCount, 'Three Technology accounts were inserted.');
        System.assertEquals(2, result.records.size(), 'Page size should cap the returned rows.');
        System.assertEquals(true, result.hasMore, 'A third row remains on page 2.');
        System.assertEquals('Toolkit Test 0', result.records[0].get('Name'));
    }

    @IsTest
    static void searchesAcrossAllowListedFields() {
        Test.startTest();
        QueryResult result = GenericQueryService.query(
            'Account',
            new List<String>{ 'Name' },
            null,
            null,
            null,
            'Test 4',
            new List<String>{ 'Name' },
            1,
            10
        );
        Test.stopTest();

        System.assertEquals(1, result.totalCount);
        System.assertEquals('Toolkit Test 4', result.records[0].get('Name'));
    }

    @IsTest
    static void silentlyDropsUnknownFieldsInsteadOfFailing() {
        Test.startTest();
        QueryResult result = GenericQueryService.query(
            'Account',
            new List<String>{ 'Name', 'NotARealField__x' },
            new List<QueryFilter>{ new QueryFilter('NotARealField__x', '=', 'x') },
            'NotARealField__x',
            'ASC',
            null,
            null,
            1,
            10
        );
        Test.stopTest();

        System.assertEquals(5, result.records.size(), 'Unknown filter/sort fields are ignored, not fatal.');
    }

    @IsTest
    static void throwsAuraHandledExceptionForUnknownObject() {
        Boolean threw = false;
        try {
            GenericQueryService.query('NotAnObject__x', new List<String>{ 'Name' }, null, null, null, null, null, 1, 10);
        } catch (AuraHandledException ex) {
            threw = true;
        }
        System.assertEquals(true, threw, 'Unknown object names must raise a client-visible error.');
    }

    @IsTest
    static void cursorPaginationWalksForwardById() {
        List<Account> allAccounts = [SELECT Id FROM Account ORDER BY Id ASC];

        Test.startTest();
        CursorQueryResult firstPage = GenericQueryService.queryWithCursor(
            'Account',
            new List<String>{ 'Name' },
            null,
            null,
            null,
            null,
            2
        );
        CursorQueryResult secondPage = GenericQueryService.queryWithCursor(
            'Account',
            new List<String>{ 'Name' },
            null,
            null,
            null,
            firstPage.nextCursor,
            2
        );
        Test.stopTest();

        System.assertEquals(2, firstPage.records.size());
        System.assertEquals(true, firstPage.hasMore);
        System.assertEquals(allAccounts[0].Id, firstPage.records[0].Id);
        System.assertEquals(allAccounts[2].Id, secondPage.records[0].Id, 'Second page should resume right after the cursor.');
    }

    @IsTest
    static void cursorPaginationReportsNoMoreOnTheLastPage() {
        Test.startTest();
        CursorQueryResult lastPage = GenericQueryService.queryWithCursor(
            'Account',
            new List<String>{ 'Name' },
            null,
            null,
            null,
            null,
            10
        );
        Test.stopTest();

        System.assertEquals(5, lastPage.records.size());
        System.assertEquals(false, lastPage.hasMore);
        System.assertEquals(null, lastPage.nextCursor);
    }
}
