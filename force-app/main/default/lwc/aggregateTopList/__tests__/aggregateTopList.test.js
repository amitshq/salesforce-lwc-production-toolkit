import { createElement } from 'lwc';
import AggregateTopList from 'c/aggregateTopList';
import summarize from '@salesforce/apex/GenericAggregateService.summarize';

jest.mock('@salesforce/apex/GenericAggregateService.summarize', () => ({ default: jest.fn() }), { virtual: true });

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

async function createList(props = {}) {
    const element = createElement('c-aggregate-top-list', { is: AggregateTopList });
    Object.assign(element, { label: 'Top owners', objectApiName: 'Opportunity', groupByField: 'Owner.Name', ...props });
    document.body.appendChild(element);
    await flushPromises();
    await flushPromises();
    return element;
}

function itemTexts(element) {
    return Array.from(element.shadowRoot.querySelectorAll('.top-item')).map((item) => [
        item.querySelector('.rank').textContent,
        item.querySelector('.name').textContent,
        item.querySelector('.value').textContent,
        item.querySelector('.bar').getAttribute('style')
    ]);
}

describe('c-aggregate-top-list', () => {
    beforeEach(() => {
        summarize.mockResolvedValue([
            { groups: { 'Owner.Name': 'Ann' }, values: { value: 900 } },
            { groups: { 'Owner.Name': 'Bea' }, values: { value: 450 } },
            { groups: { 'Owner.Name': null }, values: { value: 90 } }
        ]);
    });

    afterEach(() => {
        jest.resetAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('asks for the top groups by the aggregate, once, however many settings it is given', async () => {
        await createList({
            functionName: 'SUM',
            fieldName: 'Amount',
            maxItems: 5,
            filters: [{ fieldName: 'IsClosed', operatorName: '=', value: false }],
            havingConditions: [{ alias: 'value', operatorName: '>', value: 50 }]
        });

        expect(summarize).toHaveBeenCalledTimes(1);
        expect(summarize).toHaveBeenCalledWith({
            request: {
                objectApiName: 'Opportunity',
                aggregates: [{ functionName: 'SUM', fieldName: 'Amount', alias: 'value' }],
                groupByFields: ['Owner.Name'],
                filters: [{ fieldName: 'IsClosed', operatorName: '=', value: false }],
                havingConditions: [{ alias: 'value', operatorName: '>', value: 50 }],
                orderBy: 'value',
                orderDirection: 'DESC',
                maxGroups: 5
            }
        });
    });

    it('ranks the groups with their values and bars scaled to the leader', async () => {
        const element = await createList({ format: 'currency', currencyCode: 'USD' });

        expect(itemTexts(element)).toEqual([
            ['1', 'Ann', '$900.00', 'width: 100%'],
            ['2', 'Bea', '$450.00', 'width: 50%'],
            ['3', '(blank)', '$90.00', 'width: 10%']
        ]);
    });

    it('counts by default and can rank the lowest first', async () => {
        await createList({ orderDirection: 'asc', maxItems: 'nonsense' });

        const { request } = summarize.mock.calls[0][0];
        expect(request.aggregates).toEqual([{ functionName: 'COUNT', fieldName: null, alias: 'value' }]);
        expect(request.orderDirection).toBe('ASC');
        expect(request.maxGroups).toBe(10);
    });

    it('queries again when a setting changes, and on refresh()', async () => {
        const element = await createList();
        element.maxItems = 3;
        await flushPromises();
        await element.refresh();

        expect(summarize).toHaveBeenCalledTimes(3);
        expect(summarize.mock.calls[1][0].request.maxGroups).toBe(3);
    });

    it('says when there is nothing to rank', async () => {
        summarize.mockResolvedValue([]);
        const element = await createList({ emptyMessage: 'No open deals.' });

        expect(element.shadowRoot.querySelector('.empty').textContent).toBe('No open deals.');
        expect(element.shadowRoot.querySelector('.top-list')).toBeNull();
    });

    it('shows the server error', async () => {
        summarize.mockRejectedValue({ body: { message: 'Cannot group by "Description"' } });
        const element = await createList({ groupByField: 'Description' });

        expect(element.shadowRoot.querySelector('.error').textContent).toBe('Cannot group by "Description"');
    });

    it('needs an object and a group-by field', async () => {
        const element = await createList({ groupByField: undefined });

        expect(summarize).not.toHaveBeenCalled();
        expect(element.shadowRoot.querySelector('.error').textContent).toContain('groupByField');
    });

    it('ignores a slow answer that a newer query has overtaken', async () => {
        let answerFirst;
        summarize
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        answerFirst = () => resolve([{ groups: { g: 'Old' }, values: { value: 1 } }]);
                    })
            )
            .mockResolvedValueOnce([{ groups: { g: 'New' }, values: { value: 2 } }]);
        const element = await createList();
        element.maxItems = 2;
        await flushPromises();
        answerFirst();
        await flushPromises();

        expect(itemTexts(element).map((item) => item[1])).toEqual(['New']);
    });
});
