/**
 * Page of results returned by GenericQueryService.query().
 */
public with sharing class QueryResult {
    /** SOQL refuses an OFFSET above 2,000, so page-by-page browsing cannot go deeper than this. */
    public static final Integer MAX_OFFSET = 2000;

    @AuraEnabled public List<SObject> records;
    @AuraEnabled public Integer totalCount;
    @AuraEnabled public Boolean hasMore;
    @AuraEnabled public Integer pageNumber;
    @AuraEnabled public Integer pageSize;
    /** The last page that can be requested at this page size (the OFFSET limit), whatever totalCount says. */
    @AuraEnabled public Integer maxPageNumber;

    public QueryResult(List<SObject> records, Integer totalCount, Integer pageNumber, Integer pageSize) {
        this(records, totalCount, pageNumber, pageSize, MAX_OFFSET / pageSize + 1);
    }

    /** For a pager with a different reach than OFFSET's, such as CursorPagingService's 100,000 rows. */
    public QueryResult(List<SObject> records, Integer totalCount, Integer pageNumber, Integer pageSize, Integer maxPageNumber) {
        this.records = records;
        this.totalCount = totalCount;
        this.pageNumber = pageNumber;
        this.pageSize = pageSize;
        this.maxPageNumber = maxPageNumber;
        this.hasMore = (pageNumber * pageSize) < totalCount && pageNumber < this.maxPageNumber;
    }
}
