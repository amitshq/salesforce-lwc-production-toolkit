import { LightningElement, api } from 'lwc';
import summarize from '@salesforce/apex/GenericAggregateService.summarize';
import { reduceApexErrors } from 'c/apexErrorUtils';
import { formatNumber } from 'c/datatableHelpers';

const VALUE_ALIAS = 'value';
const DEFAULT_MAX_ITEMS = 10;

/**
 * A ranked "top N" list computed server-side: groups an object by a field, aggregates
 * each group (COUNT, SUM, AVG, MIN or MAX) and shows the highest first, each with a
 * bar scaled to the leader. "Top 10 owners by open pipeline" is one tag, no Apex.
 *
 * It runs GenericAggregateService.summarize (ordering by the aggregate and capping the
 * number of groups), so object and field security apply. `having-conditions` keeps
 * only groups whose value passes, using the alias "value":
 * [{ alias: 'value', operatorName: '>', value: 100000 }].
 * It re-queries when a setting changes; call `refresh()` to re-query on demand.
 *
 * @example
 * <c-aggregate-top-list
 *     label="Top owners by open pipeline"
 *     object-api-name="Opportunity"
 *     group-by-field="Owner.Name"
 *     function-name="SUM"
 *     field-name="Amount"
 *     filters={openFilters}
 *     max-items="10"
 *     format="currency"
 * ></c-aggregate-top-list>
 */
export default class AggregateTopList extends LightningElement {
    @api label = '';
    @api format = 'number'; // 'number' | 'currency' | 'percent'
    @api currencyCode;
    @api iconName;
    @api emptyMessage = 'Nothing to rank yet.';

    // The settings that decide the query; their setters queue one reload for any number of changes.
    query = {
        objectApiName: undefined,
        groupByField: undefined,
        functionName: 'COUNT',
        fieldName: undefined,
        filters: undefined,
        havingConditions: undefined,
        orderDirection: 'DESC',
        maxItems: DEFAULT_MAX_ITEMS
    };

    rows = [];
    errorMessage = '';
    isLoading = false;
    hasLoaded = false;

    requestCounter = 0;
    isActive = false;
    reloadQueued = false;

    @api
    get objectApiName() {
        return this.query.objectApiName;
    }
    set objectApiName(value) {
        this.updateQuery({ objectApiName: value });
    }

    @api
    get groupByField() {
        return this.query.groupByField;
    }
    set groupByField(value) {
        this.updateQuery({ groupByField: value });
    }

    @api
    get functionName() {
        return this.query.functionName;
    }
    set functionName(value) {
        this.updateQuery({ functionName: value || 'COUNT' });
    }

    @api
    get fieldName() {
        return this.query.fieldName;
    }
    set fieldName(value) {
        this.updateQuery({ fieldName: value });
    }

    @api
    get filters() {
        return this.query.filters;
    }
    set filters(value) {
        this.updateQuery({ filters: value });
    }

    @api
    get havingConditions() {
        return this.query.havingConditions;
    }
    set havingConditions(value) {
        this.updateQuery({ havingConditions: value });
    }

    /** DESC (default) ranks the highest first; ASC the lowest. */
    @api
    get orderDirection() {
        return this.query.orderDirection;
    }
    set orderDirection(value) {
        this.updateQuery({ orderDirection: String(value || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC' });
    }

    @api
    get maxItems() {
        return this.query.maxItems;
    }
    set maxItems(value) {
        const count = Math.floor(Number(value));
        this.updateQuery({ maxItems: count > 0 ? count : DEFAULT_MAX_ITEMS });
    }

    connectedCallback() {
        this.isActive = true;
        this.queueReload();
    }

    disconnectedCallback() {
        this.isActive = false;
    }

    @api
    refresh() {
        return this.load();
    }

    updateQuery(changes) {
        const next = { ...this.query, ...changes };
        const changed = JSON.stringify(next) !== JSON.stringify(this.query);
        this.query = next;
        if (changed) {
            this.queueReload();
        }
    }

    queueReload() {
        if (!this.isActive || this.reloadQueued) {
            return;
        }
        this.reloadQueued = true;
        Promise.resolve().then(() => {
            this.reloadQueued = false;
            if (this.isActive) {
                this.load();
            }
        });
    }

    get hasError() {
        return !!this.errorMessage;
    }

    get isEmpty() {
        return this.hasLoaded && !this.isLoading && !this.hasError && this.rows.length === 0;
    }

    get hasItems() {
        return !this.hasError && this.rows.length > 0;
    }

    get items() {
        const largest = Math.max(0, ...this.rows.map((row) => Math.abs(Number(row.value)) || 0));
        return this.rows.map((row, index) => {
            const share = largest ? Math.round((Math.abs(Number(row.value)) / largest) * 100) : 0;
            return {
                key: `item-${index}`,
                rank: index + 1,
                label: row.label,
                formattedValue: formatNumber(row.value, this.format, this.currencyCode),
                barStyle: `width: ${Number.isFinite(share) ? share : 0}%`
            };
        });
    }

    async load() {
        const { objectApiName, groupByField, functionName, fieldName, filters, havingConditions, orderDirection, maxItems } =
            this.query;
        if (!objectApiName || !groupByField) {
            this.errorMessage = 'objectApiName and groupByField are required.';
            return;
        }
        this.requestCounter += 1;
        const requestId = this.requestCounter;
        this.isLoading = true;
        this.errorMessage = '';
        try {
            const result = await summarize({
                request: {
                    objectApiName,
                    aggregates: [{ functionName, fieldName: fieldName || null, alias: VALUE_ALIAS }],
                    groupByFields: [groupByField],
                    filters: filters || [],
                    havingConditions: havingConditions || [],
                    orderBy: VALUE_ALIAS,
                    orderDirection,
                    maxGroups: maxItems
                }
            });
            if (requestId !== this.requestCounter) {
                return;
            }
            this.rows = (result || []).map((row) => {
                const groupValue = Object.values(row.groups || {})[0];
                return {
                    label: groupValue === null || groupValue === undefined || groupValue === '' ? '(blank)' : String(groupValue),
                    value: row.values ? row.values[VALUE_ALIAS] : null
                };
            });
        } catch (error) {
            if (requestId !== this.requestCounter) {
                return;
            }
            this.rows = [];
            this.errorMessage = reduceApexErrors(error).join(' ');
        } finally {
            if (requestId === this.requestCounter) {
                this.isLoading = false;
                this.hasLoaded = true;
            }
        }
    }
}
