import { LightningElement, api } from 'lwc';
import aggregate from '@salesforce/apex/GenericAggregateService.aggregate';
import { reduceApexErrors } from 'c/apexErrorUtils';

const VALUE_ALIAS = 'value';

/** Percentage change from previous to current; undefined when it is not meaningful (no baseline, non-numbers). */
function computeTrend(current, previous) {
    if (typeof current !== 'number' || typeof previous !== 'number' || !previous) {
        return undefined;
    }
    return ((current - previous) / Math.abs(previous)) * 100;
}

function toDisplayValue(raw) {
    if (raw === null || raw === undefined || raw === '') {
        return null;
    }
    const numeric = Number(raw);
    return Number.isNaN(numeric) ? raw : numeric;
}

/**
 * A KPI tile that computes its own number: one COUNT/SUM/AVG/MIN/MAX over an
 * object, evaluated server-side by GenericAggregateService (so object and
 * field security apply). It wraps c-kpi-card, so all of that component's
 * look and formatting options carry over.
 *
 * Give it `comparisonFilters` and it runs the same aggregate a second time
 * and shows the percentage change as the trend - e.g. this month's won
 * revenue against last month's. Each filter set is complete on its own.
 * It re-queries whenever one of its settings changes; call `refresh()` to
 * re-query on demand.
 *
 * @example
 * <c-aggregate-kpi-card
 *     label="Open pipeline"
 *     object-api-name="Opportunity"
 *     function-name="SUM"
 *     field-name="Amount"
 *     filters={openFilters}
 *     comparison-filters={lastMonthOpenFilters}
 *     trend-label="vs last month"
 *     format="currency"
 * ></c-aggregate-kpi-card>
 *
 * // openFilters = [{ fieldName: 'IsClosed', operatorName: '=', value: false }]
 */
export default class AggregateKpiCard extends LightningElement {
    @api label = '';
    @api trendLabel = '';
    @api format = 'number'; // 'none' | 'number' | 'currency' | 'percent'
    @api currencyCode = 'USD';
    @api iconName;
    @api variant = 'base'; // 'base' | 'success' | 'warning' | 'error'

    // The settings that decide the query. None of them is read by the template, so a
    // change would never re-render the card; their setters queue a reload instead.
    query = { objectApiName: undefined, functionName: 'COUNT', fieldName: undefined, filters: undefined, comparisonFilters: undefined };

    value;
    trend;
    errorMessage = '';
    isLoading = false;

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
    get functionName() {
        return this.query.functionName;
    }
    set functionName(value) {
        this.updateQuery({ functionName: value });
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
    get comparisonFilters() {
        return this.query.comparisonFilters;
    }
    set comparisonFilters(value) {
        this.updateQuery({ comparisonFilters: value });
    }

    connectedCallback() {
        this.isActive = true;
        this.queueReload();
    }

    disconnectedCallback() {
        this.isActive = false;
    }

    /** Re-runs the query with the current settings. */
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

    // Settings arrive one at a time; wait a microtask so they produce one query, not five.
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

    get hasComparison() {
        return Array.isArray(this.comparisonFilters) && this.comparisonFilters.length > 0;
    }

    get hasError() {
        return !!this.errorMessage;
    }

    get cardLabel() {
        return this.label || this.functionName;
    }

    async runAggregate(filters) {
        const rows = await aggregate({
            objectApiName: this.objectApiName,
            aggregates: [{ functionName: this.functionName, fieldName: this.fieldName || null, alias: VALUE_ALIAS }],
            groupByFields: [],
            filters: filters || [],
            maxGroups: 1
        });
        return toDisplayValue(rows && rows[0] ? rows[0].values[VALUE_ALIAS] : null);
    }

    async load() {
        if (!this.objectApiName) {
            this.errorMessage = 'objectApiName is required.';
            return;
        }
        this.requestCounter += 1;
        const requestId = this.requestCounter;
        this.isLoading = true;
        this.errorMessage = '';
        try {
            const [current, previous] = await Promise.all([
                this.runAggregate(this.filters),
                this.hasComparison ? this.runAggregate(this.comparisonFilters) : Promise.resolve(undefined)
            ]);
            if (requestId !== this.requestCounter) {
                return;
            }
            this.value = current;
            this.trend = this.hasComparison ? computeTrend(current, previous) : undefined;
        } catch (error) {
            if (requestId !== this.requestCounter) {
                return;
            }
            this.value = undefined;
            this.trend = undefined;
            this.errorMessage = reduceApexErrors(error).join(' ');
        } finally {
            if (requestId === this.requestCounter) {
                this.isLoading = false;
            }
        }
    }
}
