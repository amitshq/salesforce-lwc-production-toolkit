import { createElement } from 'lwc';
import AggregateKpiCard from 'c/aggregateKpiCard';
import aggregate from '@salesforce/apex/GenericAggregateService.aggregate';

jest.mock('@salesforce/apex/GenericAggregateService.aggregate', () => ({ default: jest.fn() }), { virtual: true });

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function rowsOf(value) {
    return [{ groups: {}, values: { value } }];
}

function createCard(props = {}) {
    const element = createElement('c-aggregate-kpi-card', { is: AggregateKpiCard });
    Object.assign(element, { objectApiName: 'Opportunity', label: 'Pipeline', ...props });
    document.body.appendChild(element);
    return element;
}

function kpi(element) {
    return element.shadowRoot.querySelector('c-kpi-card');
}

describe('c-aggregate-kpi-card', () => {
    afterEach(() => {
        jest.clearAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('asks the server for one aggregate and shows it on a KPI card', async () => {
        aggregate.mockResolvedValue(rowsOf(42));
        const element = createCard({ functionName: 'SUM', fieldName: 'Amount', format: 'currency', iconName: 'utility:moneybag', variant: 'success' });
        await flushPromises();

        expect(aggregate).toHaveBeenCalledTimes(1);
        expect(aggregate).toHaveBeenCalledWith({
            objectApiName: 'Opportunity',
            aggregates: [{ functionName: 'SUM', fieldName: 'Amount', alias: 'value' }],
            groupByFields: [],
            filters: [],
            maxGroups: 1
        });
        expect(kpi(element).label).toBe('Pipeline');
        expect(kpi(element).value).toBe(42);
        expect(kpi(element).format).toBe('currency');
        expect(kpi(element).iconName).toBe('utility:moneybag');
        expect(kpi(element).variant).toBe('success');
        expect(kpi(element).trend).toBeUndefined();
    });

    it('counts records by default, with no field', async () => {
        aggregate.mockResolvedValue(rowsOf(7));
        const element = createCard();
        await flushPromises();

        expect(aggregate.mock.calls[0][0].aggregates).toEqual([{ functionName: 'COUNT', fieldName: null, alias: 'value' }]);
        expect(kpi(element).value).toBe(7);
    });

    it('sends the filters', async () => {
        aggregate.mockResolvedValue(rowsOf(3));
        const filters = [{ fieldName: 'IsClosed', operatorName: '=', value: false }];
        createCard({ filters });
        await flushPromises();

        expect(aggregate.mock.calls[0][0].filters).toEqual(filters);
    });

    it('passes an empty aggregate through as no value', async () => {
        aggregate.mockResolvedValue(rowsOf(null));
        const element = createCard({ functionName: 'SUM', fieldName: 'Amount' });
        await flushPromises();

        expect(kpi(element).value).toBeNull();
    });

    it('keeps a non-numeric result (MIN of a text field) as it is', async () => {
        aggregate.mockResolvedValue(rowsOf('Acme'));
        const element = createCard({ functionName: 'MIN', fieldName: 'Name' });
        await flushPromises();

        expect(kpi(element).value).toBe('Acme');
    });

    describe('comparison', () => {
        const comparisonFilters = [{ fieldName: 'CloseDate', operatorName: '=', value: 'LAST_MONTH' }];

        it('runs the aggregate a second time and shows the percentage change as the trend', async () => {
            aggregate.mockResolvedValueOnce(rowsOf(150)).mockResolvedValueOnce(rowsOf(100));
            const element = createCard({ comparisonFilters, trendLabel: 'vs last month' });
            await flushPromises();

            expect(aggregate).toHaveBeenCalledTimes(2);
            expect(aggregate.mock.calls[1][0].filters).toEqual(comparisonFilters);
            expect(kpi(element).value).toBe(150);
            expect(kpi(element).trend).toBe(50);
            expect(kpi(element).trendLabel).toBe('vs last month');
        });

        it('shows a decline as a negative trend, measured against the size of the baseline', async () => {
            aggregate.mockResolvedValueOnce(rowsOf(50)).mockResolvedValueOnce(rowsOf(200));
            const element = createCard({ comparisonFilters });
            await flushPromises();

            expect(kpi(element).trend).toBe(-75);
        });

        it('shows no trend when the baseline is zero or empty', async () => {
            aggregate.mockResolvedValueOnce(rowsOf(10)).mockResolvedValueOnce(rowsOf(0));
            const element = createCard({ comparisonFilters });
            await flushPromises();
            expect(kpi(element).trend).toBeUndefined();

            aggregate.mockResolvedValueOnce(rowsOf(10)).mockResolvedValueOnce(rowsOf(null));
            await element.refresh();
            await flushPromises();
            expect(kpi(element).trend).toBeUndefined();
        });
    });

    describe('errors', () => {
        it('shows the server message instead of a card', async () => {
            aggregate.mockRejectedValue({ body: { message: 'SUM needs a numeric field, but "Name" is STRING.' } });
            const element = createCard({ functionName: 'SUM', fieldName: 'Name' });
            await flushPromises();

            const alert = element.shadowRoot.querySelector('[role="alert"]');
            expect(alert.textContent).toContain('Pipeline');
            expect(alert.textContent).toContain('SUM needs a numeric field');
            expect(kpi(element)).toBeNull();
        });

        it('does not call the server without an object', async () => {
            const element = createCard({ objectApiName: undefined });
            await flushPromises();

            expect(aggregate).not.toHaveBeenCalled();
            expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('objectApiName is required');
        });

        it('recovers on the next successful query', async () => {
            aggregate.mockRejectedValueOnce({ body: { message: 'Boom' } }).mockResolvedValueOnce(rowsOf(5));
            const element = createCard();
            await flushPromises();
            expect(element.shadowRoot.querySelector('[role="alert"]')).not.toBeNull();

            await element.refresh();
            await flushPromises();
            expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
            expect(kpi(element).value).toBe(5);
        });
    });

    describe('refreshing', () => {
        it('re-queries when a setting changes', async () => {
            aggregate.mockResolvedValueOnce(rowsOf(1)).mockResolvedValueOnce(rowsOf(2));
            const element = createCard();
            await flushPromises();
            expect(kpi(element).value).toBe(1);

            element.filters = [{ fieldName: 'Amount', operatorName: '>', value: 100 }];
            await flushPromises();

            expect(aggregate).toHaveBeenCalledTimes(2);
            expect(aggregate.mock.calls[1][0].filters).toEqual([{ fieldName: 'Amount', operatorName: '>', value: 100 }]);
            expect(kpi(element).value).toBe(2);
        });

        it('does not re-query when nothing changed', async () => {
            aggregate.mockResolvedValue(rowsOf(1));
            createCard();
            await flushPromises();
            await flushPromises();

            expect(aggregate).toHaveBeenCalledTimes(1);
        });

        it('does not re-query when a parent hands it an equal copy of the same filters', async () => {
            aggregate.mockResolvedValue(rowsOf(1));
            const element = createCard({ filters: [{ fieldName: 'IsClosed', operatorName: '=', value: false }] });
            await flushPromises();

            element.filters = [{ fieldName: 'IsClosed', operatorName: '=', value: false }];
            await flushPromises();

            expect(aggregate).toHaveBeenCalledTimes(1);
        });

        it('re-queries on demand', async () => {
            aggregate.mockResolvedValueOnce(rowsOf(1)).mockResolvedValueOnce(rowsOf(9));
            const element = createCard();
            await flushPromises();

            await element.refresh();
            await flushPromises();

            expect(kpi(element).value).toBe(9);
        });

        it('ignores a slow response that arrives after a newer one', async () => {
            const resolvers = [];
            aggregate.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolvers.push(resolve);
                    })
            );
            const element = createCard({ filters: [{ fieldName: 'StageName', operatorName: '=', value: 'A' }] });
            await flushPromises();
            element.filters = [{ fieldName: 'StageName', operatorName: '=', value: 'B' }];
            await flushPromises();
            expect(resolvers).toHaveLength(2);

            resolvers[1](rowsOf(200));
            await flushPromises();
            resolvers[0](rowsOf(100));
            await flushPromises();

            expect(kpi(element).value).toBe(200);
        });
    });
});
