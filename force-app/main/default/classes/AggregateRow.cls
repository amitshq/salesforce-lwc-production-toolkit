/**
 * One row of a GenericAggregateService result: the group-by values (keyed by
 * field name) and the computed aggregates (keyed by each AggregateSpec alias).
 * Without group-by fields there is a single row and `groups` is empty.
 */
public with sharing class AggregateRow {
    @AuraEnabled public Map<String, Object> groups = new Map<String, Object>();
    @AuraEnabled public Map<String, Object> values = new Map<String, Object>();
}
