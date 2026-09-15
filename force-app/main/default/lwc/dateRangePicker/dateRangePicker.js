import { LightningElement, api } from 'lwc';

const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

const PRESET_DEFINITIONS = [
    { label: 'Today', resolve: () => [new Date(), new Date()] },
    { label: 'Last 7 Days', resolve: () => [new Date(Date.now() - 6 * DAY_MS), new Date()] },
    { label: 'Last 30 Days', resolve: () => [new Date(Date.now() - 29 * DAY_MS), new Date()] },
    {
        label: 'This Month',
        resolve: () => [startOfMonth(new Date()), new Date()]
    },
    {
        label: 'Last Month',
        resolve: () => {
            const now = new Date();
            const firstOfThisMonth = startOfMonth(now);
            const lastOfPreviousMonth = new Date(firstOfThisMonth.getTime() - DAY_MS);
            return [startOfMonth(lastOfPreviousMonth), lastOfPreviousMonth];
        }
    }
];

/**
 * Two date inputs plus quick-range presets, validated (start <= end),
 * emitting ISO date strings ready to drop into a QueryFilter (">=" / "<=")
 * for GenericQueryService or c-dynamic-filter-panel.
 *
 * @example
 * <c-date-range-picker label="Created Date" onchange={handleRangeChange}></c-date-range-picker>
 *
 * // handleRangeChange(event) { const { startDate, endDate } = event.detail; }
 */
export default class DateRangePicker extends LightningElement {
    @api label = 'Date Range';
    @api required = false;
    @api hidePresets = false;

    @api
    get startDate() {
        return this._startDate;
    }
    set startDate(value) {
        this._startDate = value || '';
    }

    @api
    get endDate() {
        return this._endDate;
    }
    set endDate(value) {
        this._endDate = value || '';
    }

    _startDate = '';
    _endDate = '';
    errorMessage = '';

    get presets() {
        return PRESET_DEFINITIONS.map((preset) => ({ label: preset.label }));
    }

    get hasError() {
        return !!this.errorMessage;
    }

    handleStartChange(event) {
        this._startDate = event.detail.value;
        this.validateAndNotify();
    }

    handleEndChange(event) {
        this._endDate = event.detail.value;
        this.validateAndNotify();
    }

    handlePresetClick(event) {
        const label = event.currentTarget.dataset.label;
        const preset = PRESET_DEFINITIONS.find((p) => p.label === label);
        if (!preset) return;
        const [start, end] = preset.resolve();
        this._startDate = toIsoDate(start);
        this._endDate = toIsoDate(end);
        this.validateAndNotify();
    }

    validateAndNotify() {
        if (this._startDate && this._endDate && this._startDate > this._endDate) {
            this.errorMessage = 'Start date must be on or before the end date.';
            return;
        }
        this.errorMessage = '';
        this.dispatchEvent(
            new CustomEvent('change', { detail: { startDate: this._startDate, endDate: this._endDate } })
        );
    }
}
