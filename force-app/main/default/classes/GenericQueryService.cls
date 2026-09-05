/**
 * Generic, schema-driven SOQL query service that powers c-enterprise-datatable
 * (and anything else that needs server-side paging/sorting/filtering without a
 * bespoke Apex controller per object).
 *
 * Security model:
 *  - Object and field API names are identifiers, so they can never be safely
 *    bound as query parameters. Every identifier is validated against the
 *    running user's schema describe before it is concatenated into the query
 *    string; anything not found there is dropped (unknown field) or rejected
 *    (unknown object). Only literal *values* are placed in the query, and
 *    always via Database.queryWithBinds bind variables, never string
 *    concatenation - so this is not vulnerable to SOQL injection.
 *  - The query itself executes with AccessLevel.USER_MODE so object- and
 *    field-level security are enforced by the platform as a second layer,
 *    on top of the describe-based field allow-listing done here.
 */
public with sharing class GenericQueryService {
    private static final Set<String> SORT_DIRECTIONS = new Set<String>{ 'ASC', 'DESC' };
    private static final Integer MAX_PAGE_SIZE = 200;

    public class QueryServiceException extends Exception {
    }

    @AuraEnabled(cacheable=true)
    public static QueryResult query(
        String objectApiName,
        List<String> fields,
        List<QueryFilter> filters,
        String sortField,
        String sortDirection,
        String searchTerm,
        List<String> searchFields,
        Integer pageNumber,
        Integer pageSize
    ) {
        try {
            Schema.DescribeSObjectResult objectDescribe = describeObject(objectApiName);
            Map<String, Schema.SObjectField> fieldMap = objectDescribe.fields.getMap();

            List<String> safeFields = allowListFields(fields, fieldMap);
            if (safeFields.isEmpty()) {
                safeFields.add('Id');
            }
            if (!safeFields.contains('Id')) {
                safeFields.add(0, 'Id');
            }

            Map<String, Object> binds = new Map<String, Object>();
            List<String> whereClauses = buildFilterClauses(filters, fieldMap, binds);

            if (String.isNotBlank(searchTerm) && searchFields != null && !searchFields.isEmpty()) {
                List<String> safeSearchFields = allowListFields(searchFields, fieldMap);
                if (!safeSearchFields.isEmpty()) {
                    List<String> searchClauses = new List<String>();
                    binds.put('searchTerm', '%' + String.escapeSingleQuotes(searchTerm) + '%');
                    for (String searchField : safeSearchFields) {
                        searchClauses.add(searchField + ' LIKE :searchTerm');
                    }
                    whereClauses.add('(' + String.join(searchClauses, ' OR ') + ')');
                }
            }

            String whereClause = whereClauses.isEmpty() ? '' : ' WHERE ' + String.join(whereClauses, ' AND ');

            String safeSortField = allowListSingleField(sortField, fieldMap);
            String sortDirectionUpper = String.isBlank(sortDirection) ? '' : sortDirection.toUpperCase();
            String safeSortDirection = SORT_DIRECTIONS.contains(sortDirectionUpper) ? sortDirectionUpper : 'ASC';
            String orderByClause = String.isBlank(safeSortField)
                ? ''
                : ' ORDER BY ' + safeSortField + ' ' + safeSortDirection + ' NULLS LAST';

            Integer safePageSize = normalizePageSize(pageSize);
            Integer safePageNumber = (pageNumber == null || pageNumber < 1) ? 1 : pageNumber;
            Integer offset = (safePageNumber - 1) * safePageSize;

            String baseQuery = 'FROM ' + objectDescribe.getName() + whereClause;
            String countQuery = 'SELECT COUNT() ' + baseQuery;
            Integer totalCount = Database.countQueryWithBinds(countQuery, binds, AccessLevel.USER_MODE);

            String selectQuery =
                'SELECT ' +
                String.join(safeFields, ', ') +
                ' ' +
                baseQuery +
                orderByClause +
                ' LIMIT :limitSize OFFSET :offsetSize';
            binds.put('limitSize', safePageSize);
            binds.put('offsetSize', offset);

            List<SObject> records = Database.queryWithBinds(selectQuery, binds, AccessLevel.USER_MODE);

            return new QueryResult(records, totalCount, safePageNumber, safePageSize);
        } catch (QueryServiceException qse) {
            throw new AuraHandledException(qse.getMessage());
        } catch (Exception e) {
            throw new AuraHandledException('Unable to run query: ' + e.getMessage());
        }
    }

    private static Schema.DescribeSObjectResult describeObject(String objectApiName) {
        if (String.isBlank(objectApiName)) {
            throw new QueryServiceException('objectApiName is required.');
        }
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(objectApiName.trim());
        if (sObjectType == null) {
            throw new QueryServiceException('Unknown object: ' + objectApiName);
        }
        return sObjectType.getDescribe();
    }

    /** Keeps only fields that exist on the object and are readable by the running user. */
    private static List<String> allowListFields(List<String> requested, Map<String, Schema.SObjectField> fieldMap) {
        List<String> safe = new List<String>();
        if (requested == null) {
            return safe;
        }
        Set<String> seen = new Set<String>();
        for (String rawField : requested) {
            String safeField = allowListSingleField(rawField, fieldMap);
            if (String.isNotBlank(safeField) && !seen.contains(safeField.toLowerCase())) {
                safe.add(safeField);
                seen.add(safeField.toLowerCase());
            }
        }
        return safe;
    }

    private static String allowListSingleField(String rawField, Map<String, Schema.SObjectField> fieldMap) {
        if (String.isBlank(rawField)) {
            return null;
        }
        // Relationship paths (e.g. Owner.Name) are validated hop by hop.
        List<String> parts = rawField.trim().split('\\.');
        Map<String, Schema.SObjectField> currentFieldMap = fieldMap;
        List<String> validatedParts = new List<String>();

        for (Integer i = 0; i < parts.size(); i++) {
            String part = parts[i];
            Schema.SObjectField token = currentFieldMap == null ? null : currentFieldMap.get(part.toLowerCase());
            if (token == null) {
                return null;
            }
            Schema.DescribeFieldResult fieldDescribe = token.getDescribe();
            if (!fieldDescribe.isAccessible()) {
                return null;
            }
            validatedParts.add(fieldDescribe.getName());

            Boolean isLastPart = (i == parts.size() - 1);
            if (!isLastPart) {
                List<Schema.SObjectType> referenceTo = fieldDescribe.getReferenceTo();
                if (referenceTo.isEmpty()) {
                    return null;
                }
                currentFieldMap = referenceTo[0].getDescribe().fields.getMap();
            }
        }
        return String.join(validatedParts, '.');
    }

    private static List<String> buildFilterClauses(
        List<QueryFilter> filters,
        Map<String, Schema.SObjectField> fieldMap,
        Map<String, Object> binds
    ) {
        List<String> clauses = new List<String>();
        if (filters == null) {
            return clauses;
        }
        Integer bindIndex = 0;
        for (QueryFilter filterItem : filters) {
            if (filterItem == null || String.isBlank(filterItem.fieldName)) {
                continue;
            }
            String safeField = allowListSingleField(filterItem.fieldName, fieldMap);
            String operatorName = String.isBlank(filterItem.operatorName) ? '=' : filterItem.operatorName.toUpperCase();
            if (safeField == null || !QueryFilter.SUPPORTED_OPERATORS.contains(operatorName)) {
                continue;
            }
            String bindKey = 'f' + bindIndex;
            bindIndex++;

            Object bindValue = filterItem.value;
            if (operatorName == 'LIKE' && bindValue instanceof String) {
                String likeValue = (String) bindValue;
                bindValue = likeValue.contains('%') ? likeValue : '%' + likeValue + '%';
            }
            binds.put(bindKey, bindValue);
            clauses.add(safeField + ' ' + operatorName + ' :' + bindKey);
        }
        return clauses;
    }

    private static Integer normalizePageSize(Integer requested) {
        if (requested == null || requested < 1) {
            return 25;
        }
        return Math.min(requested, MAX_PAGE_SIZE);
    }
}
