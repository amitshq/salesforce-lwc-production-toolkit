import { createElement } from 'lwc';
import DateRangePicker from 'c/dateRangePicker';

// A user in India: five and a half hours ahead of UTC, where the old toISOString() conversion
// moved every preset back a day.
jest.mock('@salesforce/i18n/timeZone', () => ({ default: 'Asia/Kolkata' }), { virtual: true });

function createPicker() {
    const element = createElement('c-date-range-picker', { is: DateRangePicker });
    document.body.appendChild(element);
    return element;
}

function pressPreset(element, label) {
    const handler = jest.fn();
    element.addEventListener('change', handler);
    Array.from(element.shadowRoot.querySelectorAll('lightning-button'))
        .find((button) => button.label === label)
        .click();
    return handler.mock.calls[handler.mock.calls.length - 1][0].detail;
}

describe('c-date-range-picker in a time zone ahead of UTC', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('starts "This Month" on the 1st, not the last day of the previous month', () => {
        jest.setSystemTime(new Date('2026-11-10T03:00:00Z')); // 8:30am on 10 November in India

        expect(pressPreset(createPicker(), 'This Month')).toEqual({ startDate: '2026-11-01', endDate: '2026-11-10' });
    });

    it('already says the new day just after midnight there, while UTC is still on yesterday', () => {
        jest.setSystemTime(new Date('2026-10-31T19:00:00Z')); // 12:30am on 1 November in India

        expect(pressPreset(createPicker(), 'Today')).toEqual({ startDate: '2026-11-01', endDate: '2026-11-01' });
        expect(pressPreset(createPicker(), 'Last Month')).toEqual({ startDate: '2026-10-01', endDate: '2026-10-31' });
    });

    it('gives the right "Last 30 Days" range', () => {
        jest.setSystemTime(new Date('2026-11-10T03:00:00Z'));

        expect(pressPreset(createPicker(), 'Last 30 Days')).toEqual({ startDate: '2026-10-12', endDate: '2026-11-10' });
    });
});
