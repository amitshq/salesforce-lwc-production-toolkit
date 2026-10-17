/**
 * Generic COUNT / SUM / AVG / MIN / MAX over any object, with optional GROUP BY.
 * It powers c-aggregate-kpi-card, so a dashboard tile needs no bespoke Apex.
 *
 * Same security model as GenericQueryService, which it reuses for validation:
 *  - Object, field and group-by names are identifiers, so each is validated
 *    against the running user's schema describe before it is concatenated into
 *    the query. Unlike the query service, an unknown or unreadable field is an
 *    error here, not a silent drop - dropping an aggregate would return a
 *    different number than the caller asked for.
 *  - Aggregate functions come from a fixed allow-list. Aliases are validated
 *    against a strict pattern and are only ever used as keys in the returned
 *    map: the SOQL itself uses generated names (g0, a0, ...).
 *  - Filter values are bound via Database.queryWithBinds, and the query runs
 *    with AccessLevel.USER_MODE, so object and field-level security apply on
 *    top of the allow-listing.
 */
public with sharing class GenericAggregateService {
    private static final Set<String> SUPPORTED_FUNCTIONS = new Set<String>{ 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX' };
    private static final Set<String> NUMERIC_ONLY_FUNCTIONS = new Set<String>{ 'SUM', 'AVG' };
    private static final Set<Schema.DisplayType> NUMERIC_TYPES = new Set<Schema.DisplayType>{
        Schema.DisplayType.INTEGER,
        Schema.DisplayType.LONG,
        Schema.DisplayType.DOUBLE,
        Schema.DisplayType.CURRENCY,
        Schema.DisplayType.PERCENT
    };
    private static final Pattern ALIAS_PATTERN = Pattern.compile('[A-Za-z][A-Za-z0-9_]{0,29}');
    private static final Integer MAX_AGGREGATES = 10;
    private static final Integer MAX_GROUP_FIELDS = 3;
    private static final Integer DEFAULT_MAX_GROUPS = 50;
    private static final Integer MAX_GROUPS_CAP = 200;

    public class AggregateServiceException extends Exception {
    }

    /**
     * Runs one aggregate query. Without groupByFields the result is a single row
     * (with an empty `groups` map); with them there is one row per distinct
     * combination, ordered by the group-by fields and capped at maxGroups
     * (default 50, never more than 200) - when there are more groups than the
     * cap, the ones first in that order are returned.
     *
     * COUNT with no fieldName counts records; with a fieldName it counts the
     * records where that field is not null. SUM and AVG need a numeric field.
     * Nulls are ignored by SUM, AVG, MIN and MAX, so an empty set gives null,
     * not 0 (except COUNT, which gives 0).
     */
    @AuraEnabled(cacheable=true)
    public static List<AggregateRow> aggregate(
        String objectApiName,
        List<AggregateSpec> aggregates,
        List<String> groupByFields,
        List<QueryFilter> filters,
        Integer maxGroups
    ) {
        try {
            if (aggregates == null || aggregates.isEmpty()) {
                throw new AggregateServiceException('At least one aggregate is required.');
            }
            if (aggregates.size() > MAX_AGGREGATES) {
                throw new AggregateServiceException('At most ' + MAX_AGGREGATES + ' aggregates are allowed per query.');
            }

            Schema.DescribeSObjectResult objectDescribe = GenericQueryService.describeObject(objectApiName);
            Map<String, Schema.SObjectField> fieldMap = objectDescribe.fields.getMap();

            List<String> groupFields = resolveGroupFields(groupByFields, fieldMap);
            List<String> aliases = new List<String>();
            List<String> selectParts = new List<String>();
            for (Integer i = 0; i < groupFields.size(); i++) {
                selectParts.add(groupFields[i] + ' g' + i);
            }
            Set<String> seenAliases = new Set<String>();
            for (Integer i = 0; i < aggregates.size(); i++) {
                AggregateSpec spec = aggregates[i];
                String alias = validateAlias(spec, seenAliases);
                aliases.add(alias);
                selectParts.add(buildExpression(spec, fieldMap) + ' a' + i);
            }

            Map<String, Object> binds = new Map<String, Object>();
            List<String> whereClauses = GenericQueryService.buildFilterClauses(filters, fieldMap, binds);

            String query = 'SELECT ' + String.join(selectParts, ', ') + ' FROM ' + objectDescribe.getName();
            if (!whereClauses.isEmpty()) {
                query += ' WHERE ' + String.join(whereClauses, ' AND ');
            }
            if (!groupFields.isEmpty()) {
                String groupList = String.join(groupFields, ', ');
                query += ' GROUP BY ' + groupList + ' ORDER BY ' + groupList + ' LIMIT :limitSize';
                binds.put('limitSize', normalizeMaxGroups(maxGroups));
            }

            List<SObject> rawRows = Database.queryWithBinds(query, binds, AccessLevel.USER_MODE);

            List<AggregateRow> rows = new List<AggregateRow>();
            for (SObject rawRow : rawRows) {
                AggregateResult source = (AggregateResult) rawRow;
                AggregateRow row = new AggregateRow();
                for (Integer i = 0; i < groupFields.size(); i++) {
                    row.groups.put(groupFields[i], source.get('g' + i));
                }
                for (Integer i = 0; i < aliases.size(); i++) {
                    row.values.put(aliases[i], source.get('a' + i));
                }
                rows.add(row);
            }
            return rows;
        } catch (AggregateServiceException ase) {
            throw toAuraException(ase.getMessage());
        } catch (GenericQueryService.QueryServiceException qse) {
            throw toAuraException(qse.getMessage());
        } catch (Exception e) {
            throw toAuraException('Unable to run aggregate query: ' + e.getMessage());
        }
    }

    private static List<String> resolveGroupFields(List<String> requested, Map<String, Schema.SObjectField> fieldMap) {
        List<String> safe = new List<String>();
        if (requested == null) {
            return safe;
        }
        Set<String> seen = new Set<String>();
        for (String rawField : requested) {
            if (String.isBlank(rawField)) {
                continue;
            }
            GenericQueryService.ResolvedField resolved = GenericQueryService.resolveField(rawField, fieldMap);
            if (resolved == null) {
                throw new AggregateServiceException('Cannot group by "' + rawField + '": unknown or inaccessible field.');
            }
            if (!resolved.describe.isGroupable()) {
                throw new AggregateServiceException('Cannot group by "' + rawField + '": this field type does not support grouping.');
            }
            if (seen.add(resolved.path.toLowerCase())) {
                safe.add(resolved.path);
            }
        }
        if (safe.size() > MAX_GROUP_FIELDS) {
            throw new AggregateServiceException('At most ' + MAX_GROUP_FIELDS + ' group-by fields are allowed.');
        }
        return safe;
    }

    private static String validateAlias(AggregateSpec spec, Set<String> seenAliases) {
        if (spec == null || String.isBlank(spec.alias) || !ALIAS_PATTERN.matcher(spec.alias).matches()) {
            throw new AggregateServiceException(
                'Aggregate alias "' + (spec == null ? '' : spec.alias) + '" is not valid: use letters, numbers and underscores, starting with a letter (30 characters at most).'
            );
        }
        if (!seenAliases.add(spec.alias.toLowerCase())) {
            throw new AggregateServiceException('Aggregate alias "' + spec.alias + '" is used more than once.');
        }
        return spec.alias;
    }

    private static String buildExpression(AggregateSpec spec, Map<String, Schema.SObjectField> fieldMap) {
        if (String.isBlank(spec.functionName)) {
            throw new AggregateServiceException('Each aggregate needs a function name.');
        }
        String functionName = spec.functionName.trim().toUpperCase();
        if (!SUPPORTED_FUNCTIONS.contains(functionName)) {
            throw new AggregateServiceException(
                'Unsupported aggregate function "' + spec.functionName + '": use COUNT, SUM, AVG, MIN or MAX.'
            );
        }
        if (String.isBlank(spec.fieldName)) {
            if (functionName != 'COUNT') {
                throw new AggregateServiceException(functionName + ' needs a field to aggregate.');
            }
            return 'COUNT(Id)';
        }
        GenericQueryService.ResolvedField resolved = GenericQueryService.resolveField(spec.fieldName, fieldMap);
        if (resolved == null) {
            throw new AggregateServiceException(
                'Cannot ' + functionName + ' "' + spec.fieldName + '": unknown or inaccessible field.'
            );
        }
        if (NUMERIC_ONLY_FUNCTIONS.contains(functionName) && !NUMERIC_TYPES.contains(resolved.describe.getType())) {
            throw new AggregateServiceException(
                functionName + ' needs a numeric field, but "' + spec.fieldName + '" is ' + resolved.describe.getType() + '.'
            );
        }
        return functionName + '(' + resolved.path + ')';
    }

    private static Integer normalizeMaxGroups(Integer requested) {
        if (requested == null || requested < 1) {
            return DEFAULT_MAX_GROUPS;
        }
        return Math.min(requested, MAX_GROUPS_CAP);
    }

    // AuraHandledException hides its message from getMessage() unless setMessage is called.
    private static AuraHandledException toAuraException(String message) {
        AuraHandledException ex = new AuraHandledException(message);
        ex.setMessage(message);
        return ex;
    }
}
