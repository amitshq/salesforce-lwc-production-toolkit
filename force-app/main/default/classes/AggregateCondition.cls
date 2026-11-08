/**
 * One HAVING condition for GenericAggregateService.summarize(): compares the aggregate
 * named by `alias` with `value`, e.g. { alias: 'pipeline', operatorName: '>', value: 100000 }.
 *
 * operatorName: =, !=, <, <=, > or >=. The value is bound, never concatenated, and is
 * converted to the aggregate's type (a whole number for COUNT, a date for MIN/MAX of a
 * date field, and so on).
 */
public with sharing class AggregateCondition {
    @AuraEnabled public String alias;
    @AuraEnabled public String operatorName;
    @AuraEnabled public Object value;

    public AggregateCondition() {
    }

    public AggregateCondition(String alias, String operatorName, Object value) {
        this.alias = alias;
        this.operatorName = operatorName;
        this.value = value;
    }
}
