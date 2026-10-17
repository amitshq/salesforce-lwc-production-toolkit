/**
 * One aggregate to compute in GenericAggregateService.aggregate().
 *
 * functionName: COUNT, SUM, AVG, MIN or MAX.
 * fieldName: the field to aggregate; may be blank for COUNT (counts records).
 * alias: the key the result is returned under in AggregateRow.values. It is
 *        only ever used as a JSON key, never placed in the SOQL string.
 */
public with sharing class AggregateSpec {
    @AuraEnabled public String functionName;
    @AuraEnabled public String fieldName;
    @AuraEnabled public String alias;

    public AggregateSpec() {
    }

    public AggregateSpec(String functionName, String fieldName, String alias) {
        this.functionName = functionName;
        this.fieldName = fieldName;
        this.alias = alias;
    }
}
