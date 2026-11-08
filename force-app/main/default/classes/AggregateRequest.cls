/**
 * Everything GenericAggregateService.summarize() needs for one aggregate query.
 *
 * objectApiName, aggregates, groupByFields, filters: as for aggregate().
 * searchTerm, searchFields: the same LIKE search c-enterprise-datatable sends to
 *     GenericQueryService, so a totals row covers exactly the rows the table matches.
 * havingConditions: conditions on aggregate values (HAVING), each naming an aggregate by its alias.
 *     They need groupByFields.
 * orderBy: an aggregate alias or a group-by field to order the groups by; orderDirection
 *     is ASC or DESC (default DESC for an alias, ASC for a field). With maxGroups this is
 *     a top-N: "the 10 owners with the most pipeline".
 * maxGroups: as for aggregate() (default 50, at most 200).
 */
public with sharing class AggregateRequest {
    @AuraEnabled public String objectApiName;
    @AuraEnabled public List<AggregateSpec> aggregates;
    @AuraEnabled public List<String> groupByFields;
    @AuraEnabled public List<QueryFilter> filters;
    @AuraEnabled public String searchTerm;
    @AuraEnabled public List<String> searchFields;
    @AuraEnabled public List<AggregateCondition> havingConditions;
    @AuraEnabled public String orderBy;
    @AuraEnabled public String orderDirection;
    @AuraEnabled public Integer maxGroups;

    public AggregateRequest() {
    }

    public AggregateRequest(String objectApiName, List<AggregateSpec> aggregates) {
        this.objectApiName = objectApiName;
        this.aggregates = aggregates;
    }
}
