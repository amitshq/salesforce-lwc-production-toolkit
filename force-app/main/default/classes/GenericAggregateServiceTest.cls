@IsTest
private class GenericAggregateServiceTest {
    @TestSetup
    static void setup() {
        insert new List<Account>{
            new Account(Name = 'Agg Test 0', Industry = 'Technology', AnnualRevenue = 100),
            new Account(Name = 'Agg Test 1', Industry = 'Banking', AnnualRevenue = 200),
            new Account(Name = 'Agg Test 2', Industry = 'Technology', AnnualRevenue = 300),
            new Account(Name = 'Agg Test 3', Industry = 'Technology', AnnualRevenue = 600),
            new Account(Name = 'Agg Test 4', Industry = 'Banking')
        };
    }

    // Aggregate values come back as Integer, Decimal or Double depending on the function and field.
    private static Decimal num(Object value) {
        return Decimal.valueOf(String.valueOf(value));
    }

    private static String errorMessageFor(
        String objectApiName,
        List<AggregateSpec> aggregates,
        List<String> groupByFields,
        List<QueryFilter> filters
    ) {
        try {
            GenericAggregateService.aggregate(objectApiName, aggregates, groupByFields, filters, null);
        } catch (AuraHandledException ex) {
            return ex.getMessage();
        }
        return null;
    }

    @IsTest
    static void countsAndSumsPerGroup() {
        Test.startTest();
        List<AggregateRow> rows = GenericAggregateService.aggregate(
            'Account',
            new List<AggregateSpec>{
                new AggregateSpec('COUNT', null, 'total'),
                new AggregateSpec('SUM', 'AnnualRevenue', 'revenue')
            },
            new List<String>{ 'Industry' },
            null,
            null
        );
        Test.stopTest();

        System.assertEquals(2, rows.size(), 'One row per industry.');
        System.assertEquals('Banking', rows[0].groups.get('Industry'), 'Rows are ordered by the group-by field.');
        System.assertEquals(2, num(rows[0].values.get('total')).intValue());
        System.assertEquals(200, num(rows[0].values.get('revenue')).intValue(), 'A null revenue adds nothing to a SUM.');
        System.assertEquals('Technology', rows[1].groups.get('Industry'));
        System.assertEquals(3, num(rows[1].values.get('total')).intValue());
        System.assertEquals(1000, num(rows[1].values.get('revenue')).intValue());
    }

    @IsTest
    static void returnsASingleRowWithoutGrouping() {
        Test.startTest();
        List<AggregateRow> rows = GenericAggregateService.aggregate(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('count', null, 'n') },
            null,
            null,
            null
        );
        Test.stopTest();

        System.assertEquals(1, rows.size());
        System.assertEquals(true, rows[0].groups.isEmpty());
        System.assertEquals(5, num(rows[0].values.get('n')).intValue(), 'Function names are case-insensitive.');
    }

    @IsTest
    static void countingAFieldSkipsRecordsWhereItIsNull() {
        Test.startTest();
        List<AggregateRow> rows = GenericAggregateService.aggregate(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('COUNT', 'AnnualRevenue', 'withRevenue') },
            null,
            null,
            null
        );
        Test.stopTest();

        System.assertEquals(4, num(rows[0].values.get('withRevenue')).intValue());
    }

    @IsTest
    static void computesAverageMinAndMax() {
        Test.startTest();
        List<AggregateRow> rows = GenericAggregateService.aggregate(
            'Account',
            new List<AggregateSpec>{
                new AggregateSpec('AVG', 'AnnualRevenue', 'average'),
                new AggregateSpec('MIN', 'AnnualRevenue', 'lowest'),
                new AggregateSpec('MAX', 'AnnualRevenue', 'highest')
            },
            new List<String>{ 'Industry' },
            null,
            null
        );
        Test.stopTest();

        AggregateRow technology = rows[1];
        System.assertEquals(333, num(technology.values.get('average')).setScale(0, RoundingMode.HALF_UP).intValue());
        System.assertEquals(100, num(technology.values.get('lowest')).intValue());
        System.assertEquals(600, num(technology.values.get('highest')).intValue());
    }

    @IsTest
    static void appliesFiltersWithBoundValues() {
        Test.startTest();
        List<AggregateRow> rows = GenericAggregateService.aggregate(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'n') },
            null,
            new List<QueryFilter>{
                new QueryFilter('Industry', '=', 'Technology'),
                new QueryFilter('AnnualRevenue', '>', 150)
            },
            null
        );
        Test.stopTest();

        System.assertEquals(2, num(rows[0].values.get('n')).intValue());
    }

    @IsTest
    static void sumOfNothingIsNullButCountIsZero() {
        Test.startTest();
        List<AggregateRow> rows = GenericAggregateService.aggregate(
            'Account',
            new List<AggregateSpec>{
                new AggregateSpec('COUNT', null, 'n'),
                new AggregateSpec('SUM', 'AnnualRevenue', 'revenue')
            },
            null,
            new List<QueryFilter>{ new QueryFilter('Industry', '=', 'No Such Industry') },
            null
        );
        Test.stopTest();

        System.assertEquals(0, num(rows[0].values.get('n')).intValue());
        System.assertEquals(null, rows[0].values.get('revenue'));
    }

    @IsTest
    static void capsTheNumberOfGroups() {
        Test.startTest();
        List<AggregateRow> rows = GenericAggregateService.aggregate(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'n') },
            new List<String>{ 'Name' },
            null,
            2
        );
        Test.stopTest();

        System.assertEquals(2, rows.size(), 'maxGroups limits the number of rows.');
        System.assertEquals('Agg Test 0', rows[0].groups.get('Name'));
    }

    @IsTest
    static void groupsByARelationshipPath() {
        Test.startTest();
        List<AggregateRow> rows = GenericAggregateService.aggregate(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'n') },
            new List<String>{ 'Owner.Name' },
            null,
            null
        );
        Test.stopTest();

        System.assertEquals(1, rows.size(), 'Every test account is owned by the running user.');
        System.assertEquals(UserInfo.getName(), rows[0].groups.get('Owner.Name'));
        System.assertEquals(5, num(rows[0].values.get('n')).intValue());
    }

    @IsTest
    static void requiresAtLeastOneAggregate() {
        System.assert(errorMessageFor('Account', new List<AggregateSpec>(), null, null).contains('At least one aggregate'));
        System.assert(errorMessageFor('Account', null, null, null).contains('At least one aggregate'));
    }

    @IsTest
    static void rejectsAnUnsupportedFunction() {
        String message = errorMessageFor(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('MEDIAN', 'AnnualRevenue', 'm') },
            null,
            null
        );

        System.assertNotEquals(null, message, 'MEDIAN is not in the allow-list.');
        System.assert(message.contains('Unsupported aggregate function'), message);
    }

    @IsTest
    static void rejectsAnAliasThatCouldNotBeASafeKey() {
        for (String badAlias : new List<String>{ 'bad alias', '1abc', 'a;DROP', 'x-y', '', null, 'a'.repeat(31) }) {
            String message = errorMessageFor(
                'Account',
                new List<AggregateSpec>{ new AggregateSpec('COUNT', null, badAlias) },
                null,
                null
            );
            System.assertNotEquals(null, message, 'Alias should be rejected: ' + badAlias);
            System.assert(message.contains('alias'), message);
        }
    }

    @IsTest
    static void rejectsDuplicateAliases() {
        String message = errorMessageFor(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'n'), new AggregateSpec('SUM', 'AnnualRevenue', 'N') },
            null,
            null
        );

        System.assertNotEquals(null, message);
        System.assert(message.contains('more than once'), message);
    }

    @IsTest
    static void rejectsSumOnANonNumericField() {
        String message = errorMessageFor(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('SUM', 'Name', 'total') },
            null,
            null
        );

        System.assertNotEquals(null, message);
        System.assert(message.contains('numeric field'), message);
    }

    @IsTest
    static void rejectsAFunctionThatNeedsAFieldButHasNone() {
        String message = errorMessageFor(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('SUM', null, 'total') },
            null,
            null
        );

        System.assertNotEquals(null, message);
        System.assert(message.contains('needs a field'), message);
    }

    @IsTest
    static void rejectsUnknownFieldsInsteadOfDroppingThem() {
        String aggregateMessage = errorMessageFor(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('SUM', 'NotARealField__c', 'total') },
            null,
            null
        );
        String groupMessage = errorMessageFor(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'n') },
            new List<String>{ 'NotARealField__c' },
            null
        );

        System.assert(aggregateMessage != null && aggregateMessage.contains('unknown or inaccessible'), aggregateMessage);
        System.assert(groupMessage != null && groupMessage.contains('unknown or inaccessible'), groupMessage);
    }

    @IsTest
    static void rejectsGroupingByAFieldTypeThatCannotBeGrouped() {
        String message = errorMessageFor(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'n') },
            new List<String>{ 'Description' },
            null
        );

        System.assertNotEquals(null, message, 'Long text areas cannot be grouped.');
        System.assert(message.contains('does not support grouping'), message);
    }

    @IsTest
    static void rejectsTooManyGroupByFields() {
        String message = errorMessageFor(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'n') },
            new List<String>{ 'Industry', 'Type', 'Rating', 'Name' },
            null
        );

        System.assertNotEquals(null, message);
        System.assert(message.contains('At most'), message);
    }

    @IsTest
    static void rejectsAnUnknownObject() {
        String message = errorMessageFor(
            'NotAnObject__x',
            new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'n') },
            null,
            null
        );

        System.assertNotEquals(null, message);
        System.assert(message.contains('Unknown object'), message);
    }

    private static AggregateRequest byIndustry(List<AggregateSpec> aggregates) {
        AggregateRequest request = new AggregateRequest('Account', aggregates);
        request.groupByFields = new List<String>{ 'Industry' };
        return request;
    }

    private static String summarizeError(AggregateRequest request) {
        try {
            GenericAggregateService.summarize(request);
        } catch (AuraHandledException ex) {
            return ex.getMessage();
        }
        return null;
    }

    @IsTest
    static void ordersGroupsByAnAggregateForATopN() {
        AggregateRequest request = byIndustry(new List<AggregateSpec>{ new AggregateSpec('SUM', 'AnnualRevenue', 'revenue') });
        request.orderBy = 'revenue';
        request.maxGroups = 1;

        Test.startTest();
        List<AggregateRow> rows = GenericAggregateService.summarize(request);
        Test.stopTest();

        System.assertEquals(1, rows.size(), 'Only the top group.');
        System.assertEquals('Technology', rows[0].groups.get('Industry'), 'Ordering by an aggregate is descending by default.');
        System.assertEquals(1000, num(rows[0].values.get('revenue')).intValue());
    }

    @IsTest
    static void ordersByAnAggregateAscendingWhenAsked() {
        AggregateRequest request = byIndustry(new List<AggregateSpec>{ new AggregateSpec('SUM', 'AnnualRevenue', 'revenue') });
        request.orderBy = 'REVENUE';
        request.orderDirection = 'asc';

        List<AggregateRow> rows = GenericAggregateService.summarize(request);

        System.assertEquals('Banking', rows[0].groups.get('Industry'), 'Aliases match whatever their case.');
        System.assertEquals('Technology', rows[1].groups.get('Industry'));
    }

    @IsTest
    static void ordersByAGroupFieldInEitherDirection() {
        AggregateRequest request = byIndustry(new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'total') });
        request.orderBy = 'industry';
        request.orderDirection = 'DESC';

        List<AggregateRow> rows = GenericAggregateService.summarize(request);

        System.assertEquals('Technology', rows[0].groups.get('Industry'));
        System.assertEquals('Banking', rows[1].groups.get('Industry'));
    }

    @IsTest
    static void havingKeepsOnlyTheGroupsThatMatch() {
        AggregateRequest request = byIndustry(new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'total') });
        request.havingConditions = new List<AggregateCondition>{ new AggregateCondition('total', '>', 2) };

        Test.startTest();
        List<AggregateRow> rows = GenericAggregateService.summarize(request);
        Test.stopTest();

        System.assertEquals(1, rows.size());
        System.assertEquals('Technology', rows[0].groups.get('Industry'));
    }

    @IsTest
    static void havingAcceptsAWholeNumberWrittenAsADecimalOrText() {
        AggregateRequest request = byIndustry(new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'total') });
        request.havingConditions = new List<AggregateCondition>{ new AggregateCondition('total', '>=', 2.0), new AggregateCondition('total', '<', '3') };

        List<AggregateRow> rows = GenericAggregateService.summarize(request);

        System.assertEquals(1, rows.size(), 'Banking has two accounts.');
        System.assertEquals('Banking', rows[0].groups.get('Industry'));
    }

    @IsTest
    static void havingComparesAnAverageAsADecimal() {
        AggregateRequest request = byIndustry(new List<AggregateSpec>{ new AggregateSpec('AVG', 'AnnualRevenue', 'average') });
        request.havingConditions = new List<AggregateCondition>{ new AggregateCondition('average', '>', 250.5) };

        List<AggregateRow> rows = GenericAggregateService.summarize(request);

        System.assertEquals(1, rows.size(), 'Technology averages 333.33; Banking 200.');
        System.assertEquals('Technology', rows[0].groups.get('Industry'));
    }

    @IsTest
    static void searchNarrowsTheRowsLikeTheDatatableSearch() {
        AggregateRequest request = new AggregateRequest(
            'Account',
            new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'total'), new AggregateSpec('SUM', 'AnnualRevenue', 'revenue') }
        );
        request.searchTerm = 'Agg Test 1';
        request.searchFields = new List<String>{ 'Name' };

        List<AggregateRow> rows = GenericAggregateService.summarize(request);

        System.assertEquals(1, rows.size());
        System.assertEquals(1, num(rows[0].values.get('total')).intValue());
        System.assertEquals(200, num(rows[0].values.get('revenue')).intValue());
    }

    @IsTest
    static void rejectsAFractionForACountCondition() {
        AggregateRequest request = byIndustry(new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'total') });
        request.havingConditions = new List<AggregateCondition>{ new AggregateCondition('total', '>', 2.5) };

        String message = summarizeError(request);

        System.assert(message != null && message.contains('whole number'), message);
    }

    @IsTest
    static void rejectsHavingWithoutGrouping() {
        AggregateRequest request = new AggregateRequest('Account', new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'total') });
        request.havingConditions = new List<AggregateCondition>{ new AggregateCondition('total', '>', 1) };

        String message = summarizeError(request);

        System.assert(message != null && message.contains('group-by'), message);
    }

    @IsTest
    static void rejectsHavingConditionsThatNameNoAggregateOrUseAnUnknownOperator() {
        AggregateRequest unknownAlias = byIndustry(new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'total') });
        unknownAlias.havingConditions = new List<AggregateCondition>{ new AggregateCondition('Name', '=', 'x') };
        AggregateRequest unknownOperator = byIndustry(new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'total') });
        unknownOperator.havingConditions = new List<AggregateCondition>{ new AggregateCondition('total', 'LIKE', 1) };
        AggregateRequest missingValue = byIndustry(new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'total') });
        missingValue.havingConditions = new List<AggregateCondition>{ new AggregateCondition('total', '>', null) };

        String aliasMessage = summarizeError(unknownAlias);
        String operatorMessage = summarizeError(unknownOperator);
        String valueMessage = summarizeError(missingValue);

        System.assert(aliasMessage != null && aliasMessage.contains('does not name'), aliasMessage);
        System.assert(operatorMessage != null && operatorMessage.contains('Unsupported HAVING operator'), operatorMessage);
        System.assert(valueMessage != null && valueMessage.contains('needs a value'), valueMessage);
    }

    @IsTest
    static void rejectsOrderingByAFieldThatIsNotGroupedOrABadDirection() {
        AggregateRequest notGrouped = byIndustry(new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'total') });
        notGrouped.orderBy = 'Name';
        AggregateRequest badDirection = byIndustry(new List<AggregateSpec>{ new AggregateSpec('COUNT', null, 'total') });
        badDirection.orderBy = 'total';
        badDirection.orderDirection = 'SIDEWAYS';

        String fieldMessage = summarizeError(notGrouped);
        String directionMessage = summarizeError(badDirection);

        System.assert(fieldMessage != null && fieldMessage.contains('Cannot order by'), fieldMessage);
        System.assert(directionMessage != null && directionMessage.contains('ASC or DESC'), directionMessage);
    }

    @IsTest
    static void rejectsAMissingRequest() {
        System.assertNotEquals(null, summarizeError(null));
    }
}
