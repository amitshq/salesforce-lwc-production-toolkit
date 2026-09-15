import { LightningElement, api } from 'lwc';

/**
 * A single stat tile for dashboards: value, label, optional trend delta and
 * icon. Purely presentational - feed it a number from wherever (an
 * aggregate Apex method, GenericQueryService's totalCount, a report).
 *
 * @example
 * <c-kpi-card label="Open Opportunities" value={openCount} format="number" icon-name="utility:opportunity"></c-kpi-card>
 * <c-kpi-card label="Win Rate" value={winRate} format="percent" trend="4.2" trend-label="vs last quarter"></c-kpi-card>
 */
export default class KpiCard extends LightningElement {
    @api label = '';
    @api value;
    @api format = 'none'; // 'none' | 'number' | 'currency' | 'percent'
    @api currencyCode = 'USD';
    @api trend;
    @api trendLabel = '';
    @api iconName;
    @api variant = 'base'; // 'base' | 'success' | 'warning' | 'error'

    get formattedValue() {
        if (this.value === undefined || this.value === null || this.value === '') {
            return '—';
        }
        const numeric = Number(this.value);
        if (Number.isNaN(numeric)) {
            return String(this.value);
        }
        if (this.format === 'currency') {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: this.currencyCode, maximumFractionDigits: 0 }).format(
                numeric
            );
        }
        if (this.format === 'percent') {
            return `${numeric.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
        }
        if (this.format === 'number') {
            return numeric.toLocaleString('en-US');
        }
        return String(this.value);
    }

    get hasTrend() {
        return this.trend !== undefined && this.trend !== null && this.trend !== '' && !Number.isNaN(Number(this.trend));
    }

    get trendDirection() {
        if (!this.hasTrend) return 'neutral';
        const numeric = Number(this.trend);
        if (numeric > 0) return 'up';
        if (numeric < 0) return 'down';
        return 'neutral';
    }

    get trendDisplay() {
        if (!this.hasTrend) return '';
        const numeric = Number(this.trend);
        const sign = numeric > 0 ? '+' : '';
        return `${sign}${numeric.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
    }

    get trendIconName() {
        return { up: 'utility:arrowup', down: 'utility:arrowdown', neutral: 'utility:dash' }[this.trendDirection];
    }

    get trendClass() {
        return `trend trend-${this.trendDirection}`;
    }

    get cardClass() {
        return `kpi-card kpi-card-${this.variant}`;
    }
}
