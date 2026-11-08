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
    private static final Set<String> HAVING_OPERATORS = new Set<String>{ '=', '!=', '<', '<=', '>', '>=' };
    private static final Set<Schema.DisplayType> WHOLE_NUMBER_TYPES = new Set<Schema.DisplayType>{
        Schema.DisplayType.INTEGER,
        Schema.DisplayType.LONG
    };
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
     *
     * summarize() takes the same settings plus search, HAVING and ordering by an aggregate.
     */
    @AuraEnabled(cacheable=true)
    public static List<AggregateRow> aggregate(
        String objectApiName,
        List<AggregateSpec> aggregates,
        List<String> groupByFields,
        List<QueryFilter> filters,
        Integer maxGroups
    ) {
        AggregateRequest request = new AggregateRequest(objectApiName, aggregates);
        request.groupByFields = groupByFields;
        request.filters = filters;
        request.maxGroups = maxGroups;
        return summarize(request);
    }

    /**
     * aggregate() with more to say: `searchTerm`/`searchFields` (the datatable's search),
     * `havingConditions` (conditions on the aggregates, e.g. only owners with more than 100,000 of
     * pipeline) and `orderBy` (an aggregate alias or group-by field, with orderDirection).
     * Ordering by an aggregate and capping maxGroups gives a top-N.
     *
     * Ordering by an aggregate puts groups with a null value first when ascending and
     * last when descending, which is SOQL's default. Groups that tie are then ordered by
     * the group-by fields, so the same request always returns the same groups.
     *
     * Not cacheable: a totals row recalculated straight after a save must not be served
     * the browser's cached copy of the old numbers.
     */
    @AuraEnabled
    public static List<AggregateRow> summarize(AggregateRequest request) {
        try {
            if (request == null) {
                throw new AggregateServiceException('A request is required.');
            }
            List<AggregateSpec> aggregates = request.aggregates;
            if (aggregates == null || aggregates.isEmpty()) {
                throw new AggregateServiceException('At least one aggregate is required.');
            }
            if (aggregates.size() > MAX_AGGREGATES) {
                throw new AggregateServiceException('At most ' + MAX_AGGREGATES + ' aggregates are allowed per query.');
            }

            Schema.DescribeSObjectResult objectDescribe = GenericQueryService.describeObject(request.objectApiName);
            Map<String, Schema.SObjectField> fieldMap = objectDescribe.fields.getMap();

            List<String> groupFields = resolveGroupFields(request.groupByFields, fieldMap);
            List<String> selectParts = new List<String>();
            for (Integer i = 0; i < groupFields.size(); i++) {
                selectParts.add(groupFields[i] + ' g' + i);
            }
            List<CompiledAggregate> compiled = new List<CompiledAggregate>();
            Map<String, CompiledAggregate> byAlias = new Map<String, CompiledAggregate>();
            for (Integer i = 0; i < aggregates.size(); i++) {
                CompiledAggregate item = compile(aggregates[i], fieldMap, byAlias);
                compiled.add(item);
                selectParts.add(item.expression + ' a' + i);
            }

            Map<String, Object> binds = new Map<String, Object>();
            List<String> whereClauses = GenericQueryService.buildFilterClauses(request.filters, fieldMap, binds);
            GenericQueryService.appendSearchClause(whereClauses, binds, request.searchTerm, request.searchFields, fieldMap);

            String query = 'SELECT ' + String.join(selectParts, ', ') + ' FROM ' + objectDescribe.getName();
            if (!whereClauses.isEmpty()) {
                query += ' WHERE ' + String.join(whereClauses, ' AND ');
            }
            List<String> havingClauses = buildHavingClauses(request.havingConditions, byAlias, binds);
            if (!havingClauses.isEmpty() && groupFields.isEmpty()) {
                throw new AggregateServiceException('HAVING conditions need at least one group-by field.');
            }
            if (!groupFields.isEmpty()) {
                query += ' GROUP BY ' + String.join(groupFields, ', ');
                if (!havingClauses.isEmpty()) {
                    query += ' HAVING ' + String.join(havingClauses, ' AND ');
                }
                query += ' ORDER BY ' + buildOrderBy(request, groupFields, byAlias, fieldMap) + ' LIMIT :limitSize';
                binds.put('limitSize', normalizeMaxGroups(request.maxGroups));
            }

            List<SObject> rawRows = Database.queryWithBinds(query, binds, AccessLevel.USER_MODE);

            List<AggregateRow> rows = new List<AggregateRow>();
            for (SObject rawRow : rawRows) {
                AggregateResult source = (AggregateResult) rawRow;
                AggregateRow row = new AggregateRow();
                for (Integer i = 0; i < groupFields.size(); i++) {
                    row.groups.put(groupFields[i], source.get('g' + i));
                }
                for (Integer i = 0; i < compiled.size(); i++) {
                    row.values.put(compiled[i].alias, source.get('a' + i));
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

    /** One validated aggregate: its SOQL expression and what it returns, for HAVING and ORDER BY. */
    private class CompiledAggregate {
        public String alias;
        public String functionName;
        public String expression;
        // The aggregated field's type; null for COUNT() of records.
        public Schema.DisplayType fieldType;
    }

    private static CompiledAggregate compile(
        AggregateSpec spec,
        Map<String, Schema.SObjectField> fieldMap,
        Map<String, CompiledAggregate> byAlias
    ) {
        CompiledAggregate item = new CompiledAggregate();
        item.alias = validateAlias(spec, new Set<String>(byAlias.keySet()));
        if (String.isBlank(spec.functionName)) {
            throw new AggregateServiceException('Each aggregate needs a function name.');
        }
        item.functionName = spec.functionName.trim().toUpperCase();
        if (!SUPPORTED_FUNCTIONS.contains(item.functionName)) {
            throw new AggregateServiceException(
                'Unsupported aggregate function "' + spec.functionName + '": use COUNT, SUM, AVG, MIN or MAX.'
            );
        }
        if (String.isBlank(spec.fieldName)) {
            if (item.functionName != 'COUNT') {
                throw new AggregateServiceException(item.functionName + ' needs a field to aggregate.');
            }
            item.expression = 'COUNT(Id)';
        } else {
            GenericQueryService.ResolvedField resolved = GenericQueryService.resolveField(spec.fieldName, fieldMap);
            if (resolved == null) {
                throw new AggregateServiceException(
                    'Cannot ' + item.functionName + ' "' + spec.fieldName + '": unknown or inaccessible field.'
                );
            }
            if (NUMERIC_ONLY_FUNCTIONS.contains(item.functionName) && !NUMERIC_TYPES.contains(resolved.describe.getType())) {
                throw new AggregateServiceException(
                    item.functionName + ' needs a numeric field, but "' + spec.fieldName + '" is ' + resolved.describe.getType() + '.'
                );
            }
            item.expression = item.functionName + '(' + resolved.path + ')';
            item.fieldType = resolved.describe.getType();
        }
        byAlias.put(item.alias.toLowerCase(), item);
        return item;
    }

    private static List<String> buildHavingClauses(
        List<AggregateCondition> conditions,
        Map<String, CompiledAggregate> byAlias,
        Map<String, Object> binds
    ) {
        List<String> clauses = new List<String>();
        if (conditions == null) {
            return clauses;
        }
        for (Integer i = 0; i < conditions.size(); i++) {
            AggregateCondition condition = conditions[i];
            if (condition == null) {
                continue;
            }
            CompiledAggregate target = String.isBlank(condition.alias) ? null : byAlias.get(condition.alias.toLowerCase());
            if (target == null) {
                throw new AggregateServiceException(
                    'HAVING condition "' + condition.alias + '" does not name one of the aggregates in this request.'
                );
            }
            String operatorName = String.isBlank(condition.operatorName) ? '=' : condition.operatorName.trim();
            if (!HAVING_OPERATORS.contains(operatorName)) {
                throw new AggregateServiceException(
                    'Unsupported HAVING operator "' + condition.operatorName + '": use =, !=, <, <=, > or >=.'
                );
            }
            String bindKey = 'h' + i;
            binds.put(bindKey, coerceHavingValue(target, condition.value));
            clauses.add(target.expression + ' ' + operatorName + ' :' + bindKey);
        }
        return clauses;
    }

    /** SOQL compares a bound value with an aggregate only when their types match. */
    private static Object coerceHavingValue(CompiledAggregate target, Object value) {
        if (value == null || String.isBlank(String.valueOf(value))) {
            throw new AggregateServiceException('HAVING condition "' + target.alias + '" needs a value.');
        }
        String text = String.valueOf(value).trim();
        Boolean wantsWholeNumber =
            target.functionName == 'COUNT' || (target.functionName != 'AVG' && WHOLE_NUMBER_TYPES.contains(target.fieldType));
        Boolean wantsDecimal = target.functionName == 'AVG' || NUMERIC_TYPES.contains(target.fieldType);
        Object converted;
        try {
            if (wantsWholeNumber) {
                Decimal whole = Decimal.valueOf(text);
                converted = whole.stripTrailingZeros().scale() > 0 ? null : (Object) whole.intValue();
            } else if (wantsDecimal) {
                converted = Decimal.valueOf(text);
            } else if (target.fieldType == Schema.DisplayType.DATE) {
                converted = Date.valueOf(text);
            } else if (target.fieldType == Schema.DisplayType.DATETIME) {
                converted = (Datetime) JSON.deserialize('"' + text + '"', Datetime.class);
            } else {
                converted = text;
            }
        } catch (Exception conversionError) {
            converted = null;
        }
        if (converted == null) {
            throw new AggregateServiceException(
                'HAVING condition "' + target.alias + '": "' + text + '" is not a valid value for ' + target.expression +
                (wantsWholeNumber ? ' (it needs a whole number).' : '.')
            );
        }
        return converted;
    }

    private static String buildOrderBy(
        AggregateRequest request,
        List<String> groupFields,
        Map<String, CompiledAggregate> byAlias,
        Map<String, Schema.SObjectField> fieldMap
    ) {
        if (String.isBlank(request.orderBy)) {
            return String.join(groupFields, ', ');
        }
        String primary;
        String defaultDirection;
        String primaryGroupField;
        CompiledAggregate target = byAlias.get(request.orderBy.trim().toLowerCase());
        if (target != null) {
            primary = target.expression;
            defaultDirection = 'DESC';
        } else {
            GenericQueryService.ResolvedField resolved = GenericQueryService.resolveField(request.orderBy, fieldMap);
            for (String groupField : groupFields) {
                if (resolved != null && groupField.equalsIgnoreCase(resolved.path)) {
                    primaryGroupField = groupField;
                }
            }
            if (primaryGroupField == null) {
                throw new AggregateServiceException(
                    'Cannot order by "' + request.orderBy + '": use the alias of one of the aggregates or one of the group-by fields.'
                );
            }
            primary = primaryGroupField;
            defaultDirection = 'ASC';
        }
        String direction = String.isBlank(request.orderDirection) ? defaultDirection : request.orderDirection.trim().toUpperCase();
        if (direction != 'ASC' && direction != 'DESC') {
            throw new AggregateServiceException('orderDirection must be ASC or DESC.');
        }
        List<String> parts = new List<String>{ primary + ' ' + direction };
        for (String groupField : groupFields) {
            if (groupField != primaryGroupField) {
                parts.add(groupField);
            }
        }
        return String.join(parts, ', ');
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
