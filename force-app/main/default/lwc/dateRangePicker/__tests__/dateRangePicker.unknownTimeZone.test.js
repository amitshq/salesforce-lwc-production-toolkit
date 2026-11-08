import { createElement } from 'lwc';
import DateRangePicker from 'c/dateRangePicker';

// A time zone the browser does not recognise must not break the presets.
jest.mock('@salesforce/i18n/timeZone', () => ({ default: 'Not/A_Zone' }), { virtual: true });

describe('c-date-range-picker with an unrecognised time zone', () => {
    afterEach(() => {
        jest.useRealTimers();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it("falls back to the browser's own date instead of failing", () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(2026, 9, 31, 12, 0, 0)); // noon on 31 October, browser time
        const element = createElement('c-date-range-picker', { is: DateRangePicker });
        document.body.appendChild(element);
        const handler = jest.fn();
        element.addEventListener('change', handler);

        Array.from(element.shadowRoot.querySelectorAll('lightning-button'))
            .find((button) => button.label === 'Today')
            .click();

        expect(handler.mock.calls[0][0].detail).toEqual({ startDate: '2026-10-31', endDate: '2026-10-31' });
    });
});
