import { LightningElement, api } from 'lwc';
import USER_TIME_ZONE from '@salesforce/i18n/timeZone';

const DAY_MS = 24 * 60 * 60 * 1000;

/*
 * Presets work on calendar dates, held as Dates at UTC midnight so that adding days never
 * crosses a daylight-saving change. Converting a local Date with toISOString() used to shift
 * it: east of UTC (India, for one) "This Month" started on the last day of the previous month.
 */

/** Today's date in the user's Salesforce time zone, falling back to the browser's if the zone is unknown. */
function todayInUserTimeZone() {
    const now = new Date();
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: USER_TIME_ZONE,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        }).formatToParts(now);
        const part = (type) => Number(parts.find((p) => p.type === type).value);
        return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
    } catch (error) {
        return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    }
}

function addDays(date, days) {
    return new Date(date.getTime() + days * DAY_MS);
}

function startOfMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
}

const PRESET_DEFINITIONS = [
    { label: 'Today', resolve: (today) => [today, today] },
    { label: 'Last 7 Days', resolve: (today) => [addDays(today, -6), today] },
    { label: 'Last 30 Days', resolve: (today) => [addDays(today, -29), today] },
    { label: 'This Month', resolve: (today) => [startOfMonth(today), today] },
    {
        label: 'Last Month',
        resolve: (today) => {
            const lastOfPreviousMonth = addDays(startOfMonth(today), -1);
            return [startOfMonth(lastOfPreviousMonth), lastOfPreviousMonth];
        }
    }
];

/**
 * Two date inputs plus quick-range presets, validated (start <= end),
 * emitting ISO date strings ready to drop into a QueryFilter (">=" / "<=")
 * for GenericQueryService or c-dynamic-filter-panel. Presets follow the
 * user's Salesforce time zone, not the browser's.
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
        const [start, end] = preset.resolve(todayInUserTimeZone());
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
