/**
 * Page of results returned by GenericQueryService.query().
 */
public with sharing class QueryResult {
    @AuraEnabled public List<SObject> records;
    @AuraEnabled public Integer totalCount;
    @AuraEnabled public Boolean hasMore;
    @AuraEnabled public Integer pageNumber;
    @AuraEnabled public Integer pageSize;

    public QueryResult(List<SObject> records, Integer totalCount, Integer pageNumber, Integer pageSize) {
        this.records = records;
        this.totalCount = totalCount;
        this.pageNumber = pageNumber;
        this.pageSize = pageSize;
        this.hasMore = (pageNumber * pageSize) < totalCount;
    }
}
