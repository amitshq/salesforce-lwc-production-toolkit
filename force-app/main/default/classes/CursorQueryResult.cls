/**
 * Page of results returned by GenericQueryService.queryWithCursor().
 * Unlike QueryResult (offset pagination), there is no totalCount or
 * pageNumber - keyset pagination only ever knows "is there a next page"
 * and "what cursor gets it".
 */
public with sharing class CursorQueryResult {
    @AuraEnabled public List<SObject> records;
    @AuraEnabled public Boolean hasMore;
    @AuraEnabled public String nextCursor;

    public CursorQueryResult(List<SObject> records, Boolean hasMore, String nextCursor) {
        this.records = records;
        this.hasMore = hasMore;
        this.nextCursor = nextCursor;
    }
}
