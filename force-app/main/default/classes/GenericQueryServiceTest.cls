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
    static void resolvesRelationshipNamesInFieldPaths() {
        Test.startTest();
        QueryResult result = GenericQueryService.query(
            'Account',
            new List<String>{ 'Name', 'Owner.Name' },
            null,
            'Owner.Name',
            'ASC',
            null,
            null,
            1,
            10
        );
        Test.stopTest();

        System.assertEquals(5, result.records.size());
        SObject owner = result.records[0].getSObject('Owner');
        System.assertNotEquals(null, owner, 'Owner.Name must be queried, not silently dropped.');
        System.assertEquals(UserInfo.getName(), owner.get('Name'));
    }

    @IsTest
    static void rejectsRelationshipPathsThroughNonRelationshipFields() {
        Map<String, Schema.SObjectField> fieldMap = Account.SObjectType.getDescribe().fields.getMap();

        System.assertEquals('Owner.Name', GenericQueryService.allowListSingleField('owner.name', fieldMap));
        System.assertEquals(null, GenericQueryService.allowListSingleField('Name.Length', fieldMap), 'Name is not a relationship.');
        System.assertEquals(null, GenericQueryService.allowListSingleField('Nope.Name', fieldMap));
        System.assertEquals(null, GenericQueryService.allowListSingleField('Owner.Nope', fieldMap));
    }

    @IsTest
    static void findsNamesWithApostrophes() {
        insert new Account(Name = 'O\'Brien Holdings');

        Test.startTest();
        QueryResult result = GenericQueryService.query(
            'Account',
            new List<String>{ 'Name' },
            null,
            null,
            null,
            'O\'Brien',
            new List<String>{ 'Name' },
            1,
            10
        );
        Test.stopTest();

        System.assertEquals(1, result.totalCount, 'A bound search term must not have its quote escaped as well.');
        System.assertEquals('O\'Brien Holdings', result.records[0].get('Name'));
    }

    @IsTest
    static void treatsTypedWildcardsAsLiteralCharacters() {
        insert new List<Account>{
            new Account(Name = 'Wildcard 100% Club'),
            new Account(Name = 'Wildcard 1000 Club'),
            new Account(Name = 'Wildcard A_B'),
            new Account(Name = 'Wildcard AXB')
        };

        Test.startTest();
        QueryResult percent = GenericQueryService.query('Account', new List<String>{ 'Name' }, null, null, null, '100%', new List<String>{ 'Name' }, 1, 10);
        QueryResult underscore = GenericQueryService.query('Account', new List<String>{ 'Name' }, null, null, null, 'A_B', new List<String>{ 'Name' }, 1, 10);
        Test.stopTest();

        System.assertEquals(1, percent.totalCount, '"100%" must not also match "1000".');
        System.assertEquals('Wildcard 100% Club', percent.records[0].get('Name'));
        System.assertEquals(1, underscore.totalCount, '"A_B" must not also match "AXB".');
        System.assertEquals('Wildcard A_B', underscore.records[0].get('Name'));
    }

    @IsTest
    static void escapesLikeWildcardsButNotQuotes() {
        System.assertEquals('50\\%', GenericQueryService.escapeLikeWildcards('50%'));
        System.assertEquals('a\\_b', GenericQueryService.escapeLikeWildcards('a_b'));
        System.assertEquals('c:\\\\temp', GenericQueryService.escapeLikeWildcards('c:\\temp'));
        System.assertEquals('O\'Brien', GenericQueryService.escapeLikeWildcards('O\'Brien'));
    }

    @IsTest
    static void pagesAreStableWhenSortValuesTie() {
        // Three accounts share "Technology" and two share "Banking", so the sort alone has ties.
        List<Account> expected = [SELECT Id FROM Account ORDER BY Industry ASC NULLS LAST, Id ASC];

        Test.startTest();
        List<Id> seen = new List<Id>();
        for (Integer pageNumber = 1; pageNumber <= 3; pageNumber++) {
            QueryResult page = GenericQueryService.query(
                'Account',
                new List<String>{ 'Industry' },
                null,
                'Industry',
                'ASC',
                null,
                null,
                pageNumber,
                2
            );
            for (SObject record : page.records) {
                seen.add(record.Id);
            }
        }
        Test.stopTest();

        System.assertEquals(expected.size(), seen.size(), 'Every row appears exactly once across the pages.');
        for (Integer i = 0; i < expected.size(); i++) {
            System.assertEquals(expected[i].Id, seen[i], 'Rows that tie on the sort field come back in Id order.');
        }
    }

    @IsTest
    static void sortsByIdWhenNoSortFieldIsGiven() {
        List<Account> expected = [SELECT Id FROM Account ORDER BY Id ASC];

        Test.startTest();
        QueryResult result = GenericQueryService.query('Account', new List<String>{ 'Name' }, null, null, null, null, null, 1, 10);
        Test.stopTest();

        for (Integer i = 0; i < expected.size(); i++) {
            System.assertEquals(expected[i].Id, result.records[i].Id);
        }
    }

    @IsTest
    static void reportsTheLastReachablePageAndStopsHasMoreThere() {
        Test.startTest();
        QueryResult result = GenericQueryService.query('Account', new List<String>{ 'Name' }, null, null, null, null, null, 1, 25);
        Test.stopTest();

        System.assertEquals(81, result.maxPageNumber, 'OFFSET may be at most 2,000: at 25 a page, page 81 is the last one.');
        System.assertEquals(false, new QueryResult(new List<SObject>(), 5000, 81, 25).hasMore, 'No next page past the limit, even with more matches.');
        System.assertEquals(true, new QueryResult(new List<SObject>(), 5000, 80, 25).hasMore);
        System.assertEquals(false, new QueryResult(new List<SObject>(), 30, 2, 25).hasMore, 'The last page of a short result has no next page.');
    }

    @IsTest
    static void refusesAPagePastTheOffsetLimitWithAClearMessage() {
        Test.startTest();
        // 200 a page: page 11 starts at row 2,000, which SOQL allows; page 12 would start at 2,200.
        QueryResult lastReachable = GenericQueryService.query('Account', new List<String>{ 'Name' }, null, null, null, null, null, 11, 200);
        String message = null;
        try {
            GenericQueryService.query('Account', new List<String>{ 'Name' }, null, null, null, null, null, 12, 200);
        } catch (AuraHandledException ex) {
            message = ex.getMessage();
        }
        Test.stopTest();

        System.assertEquals(0, lastReachable.records.size());
        System.assertNotEquals(null, message, 'A page past the OFFSET limit must be refused before SOQL rejects it.');
        System.assert(message.contains('Narrow the search'), message);
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

    @IsTest
    static void batchesWalkEveryMatchingRowByIdForAnExport() {
        List<QueryFilter> filters = new List<QueryFilter>{ new QueryFilter('Industry', '=', 'Technology') };

        Test.startTest();
        CursorQueryResult first = GenericQueryService.queryBatch('Account', new List<String>{ 'Name' }, filters, null, null, null, 2);
        CursorQueryResult rest = GenericQueryService.queryBatch('Account', new List<String>{ 'Name' }, filters, null, null, first.nextCursor, 2);
        Test.stopTest();

        System.assertEquals(2, first.records.size());
        System.assertEquals(true, first.hasMore);
        System.assertEquals(1, rest.records.size(), 'Three Technology accounts in all.');
        System.assertEquals(false, rest.hasMore);
    }

    @IsTest
    static void batchesAcceptMoreRowsThanAPageAndDefaultWhenUnset() {
        Test.startTest();
        CursorQueryResult large = GenericQueryService.queryBatch('Account', new List<String>{ 'Name' }, null, null, null, null, 5000);
        CursorQueryResult unset = GenericQueryService.queryBatch('Account', new List<String>{ 'Name' }, null, null, null, null, null);
        Test.stopTest();

        System.assertEquals(5, large.records.size(), 'A batch over the 2,000 cap is clamped, not refused.');
        System.assertEquals(false, large.hasMore);
        System.assertEquals(5, unset.records.size());
    }

    @IsTest
    static void aPlanHoldsOnlyValidatedIdentifiersAndBoundValues() {
        GenericQueryService.QueryPlan queryPlan = GenericQueryService.plan(
            'account',
            new List<String>{ 'Name', 'NotAField__c' },
            new List<QueryFilter>{ new QueryFilter('Industry', '=', 'Technology') },
            'Name',
            'desc',
            'Test',
            new List<String>{ 'Name' }
        );

        System.assertEquals('SELECT COUNT() FROM Account WHERE Industry = :f0 AND (Name LIKE :searchTerm)', queryPlan.countQuery());
        System.assertEquals(
            'SELECT Id, Name FROM Account WHERE Industry = :f0 AND (Name LIKE :searchTerm) ORDER BY Name DESC NULLS LAST, Id ASC',
            queryPlan.selectQuery()
        );
        System.assertEquals('Technology', queryPlan.binds.get('f0'));
        System.assertEquals('%Test%', queryPlan.binds.get('searchTerm'));
    }
}
