import { createElement } from 'lwc';
import KpiCard from 'c/kpiCard';

function createCard(props = {}) {
    const element = createElement('c-kpi-card', { is: KpiCard });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-kpi-card', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('shows a dash when there is no value', () => {
        const element = createCard({ label: 'Open Cases' });
        expect(element.shadowRoot.querySelector('.kpi-value').textContent).toBe('—');
    });

    it('formats a plain number with thousands separators', () => {
        const element = createCard({ label: 'Accounts', value: 12500, format: 'number' });
        expect(element.shadowRoot.querySelector('.kpi-value').textContent).toBe('12,500');
    });

    it('formats currency', () => {
        const element = createCard({ label: 'Pipeline', value: 45000, format: 'currency' });
        expect(element.shadowRoot.querySelector('.kpi-value').textContent).toBe('$45,000');
    });

    it('formats percent', () => {
        const element = createCard({ label: 'Win Rate', value: 62.5, format: 'percent' });
        expect(element.shadowRoot.querySelector('.kpi-value').textContent).toBe('62.5%');
    });

    it('shows an upward trend for a positive value', () => {
        const element = createCard({ label: 'Revenue', value: 100, trend: 5.2, trendLabel: 'vs last month' });
        const trend = element.shadowRoot.querySelector('.trend');
        expect(trend.className).toContain('trend-up');
        expect(trend.textContent).toContain('+5.2%');
        expect(trend.textContent).toContain('vs last month');
    });

    it('shows a downward trend for a negative value', () => {
        const element = createCard({ label: 'Revenue', value: 100, trend: -3 });
        expect(element.shadowRoot.querySelector('.trend').className).toContain('trend-down');
    });

    it('omits the trend row entirely when no trend is given', () => {
        const element = createCard({ label: 'Revenue', value: 100 });
        expect(element.shadowRoot.querySelector('.trend')).toBeNull();
    });
});
