/**
 * A single WHERE-clause condition for GenericQueryService.
 * Field/object identifiers are validated against schema describes by the
 * service (identifiers cannot be safely bound); only the value here is
 * ever bound into the query, so no client input reaches the SOQL string.
 */
public with sharing class QueryFilter {
    @AuraEnabled public String fieldName;
    @AuraEnabled public String operatorName;
    @AuraEnabled public Object value;

    public static final Set<String> SUPPORTED_OPERATORS = new Set<String>{
        '=', '!=', '<', '<=', '>', '>=', 'LIKE', 'IN', 'NOT IN'
    };

    public QueryFilter() {
    }

    public QueryFilter(String fieldName, String operatorName, Object value) {
        this.fieldName = fieldName;
        this.operatorName = operatorName;
        this.value = value;
    }
}
