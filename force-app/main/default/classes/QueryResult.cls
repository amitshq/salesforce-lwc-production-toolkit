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
        this.records = records;
        this.totalCount = totalCount;
        this.pageNumber = pageNumber;
        this.pageSize = pageSize;
        this.maxPageNumber = MAX_OFFSET / pageSize + 1;
        this.hasMore = (pageNumber * pageSize) < totalCount && pageNumber < this.maxPageNumber;
    }
}
