@IsTest
private class CursorPagingServiceTest {
    // More than OFFSET can reach at 200 rows a page (page 12 starts at row 2,200).
    private static final Integer ROW_COUNT = 2250;

    @TestSetup
    static void setup() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < ROW_COUNT; i++) {
            accounts.add(new Account(Name = 'Deep ' + String.valueOf(i).leftPad(4, '0')));
        }
        insert accounts;
    }

    private static QueryResult page(Integer pageNumber, Integer pageSize, String direction) {
        return CursorPagingService.queryPage(
            'Account',
            new List<String>{ 'Name' },
            null,
            'Name',
            direction,
            null,
            null,
            pageNumber,
            pageSize
        );
    }

    @IsTest
    static void readsAPagePastTheOffsetLimitInSortOrder() {
        Test.startTest();
        QueryResult result = page(12, 200, 'ASC');
        Test.stopTest();

        System.assertEquals(ROW_COUNT, result.totalCount);
        System.assertEquals(50, result.records.size(), 'Rows 2,201 to 2,250.');
        System.assertEquals('Deep 2200', result.records[0].get('Name'));
        System.assertEquals('Deep 2249', result.records[49].get('Name'));
        System.assertEquals(false, result.hasMore, 'That was the last page.');
    }

    @IsTest
    static void followsTheRequestedSortDirection() {
        Test.startTest();
        QueryResult result = page(1, 25, 'DESC');
        Test.stopTest();

        System.assertEquals('Deep 2249', result.records[0].get('Name'));
        System.assertEquals(true, result.hasMore);
    }

    @IsTest
    static void reportsHowFarBrowsingCanReach() {
        Test.startTest();
        QueryResult result = page(1, 200, 'ASC');
        Test.stopTest();

        System.assertEquals(500, result.maxPageNumber, '100,000 rows at 200 a page.');
        System.assertEquals(500, CursorPagingService.maxPageNumber(200));
        System.assertEquals(4000, CursorPagingService.maxPageNumber(25));
        System.assertEquals(1429, CursorPagingService.maxPageNumber(70), 'A partly filled last page still counts.');
    }

    @IsTest
    static void returnsAnEmptyPagePastTheEnd() {
        Test.startTest();
        QueryResult result = page(40, 200, 'ASC');
        Test.stopTest();

        System.assertEquals(0, result.records.size());
        System.assertEquals(ROW_COUNT, result.totalCount);
        System.assertEquals(false, result.hasMore);
    }

    @IsTest
    static void refusesAPagePastTheCursorLimit() {
        String message;
        Test.startTest();
        try {
            page(501, 200, 'ASC');
        } catch (AuraHandledException ex) {
            message = ex.getMessage();
        }
        Test.stopTest();

        System.assertNotEquals(null, message);
        System.assert(message.contains('100,000') || message.contains('100000'), message);
    }

    @IsTest
    static void appliesFiltersAndSearchLikeTheQueryService() {
        Test.startTest();
        QueryResult result = CursorPagingService.queryPage(
            'Account',
            new List<String>{ 'Name' },
            new List<QueryFilter>{ new QueryFilter('Name', '!=', 'Deep 0001') },
            'Name',
            'ASC',
            'Deep 000',
            new List<String>{ 'Name' },
            1,
            25
        );
        Test.stopTest();

        System.assertEquals(9, result.totalCount, 'Deep 0000 to Deep 0009, less Deep 0001.');
        System.assertEquals('Deep 0000', result.records[0].get('Name'));
        System.assertEquals('Deep 0002', result.records[1].get('Name'));
    }

    @IsTest
    static void reportsAnUnknownObjectAsAClientError() {
        String message;
        try {
            CursorPagingService.queryPage('NotAnObject__x', null, null, null, null, null, null, 1, 25);
        } catch (AuraHandledException ex) {
            message = ex.getMessage();
        }
        System.assert(message != null && message.contains('Unknown object'), message);
    }
}
