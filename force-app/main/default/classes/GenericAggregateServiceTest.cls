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
}
