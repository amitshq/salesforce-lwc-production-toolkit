import { createElement } from 'lwc';
import DateRangePicker from 'c/dateRangePicker';

function createPicker(props = {}) {
    const element = createElement('c-date-range-picker', { is: DateRangePicker });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-date-range-picker', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('emits change with both dates once start and end are set in order', () => {
        const element = createPicker();
        const changeHandler = jest.fn();
        element.addEventListener('change', changeHandler);

        const [startInput, endInput] = element.shadowRoot.querySelectorAll('lightning-input');
        startInput.dispatchEvent(new CustomEvent('change', { detail: { value: '2024-01-01' } }));
        endInput.dispatchEvent(new CustomEvent('change', { detail: { value: '2024-01-31' } }));

        expect(changeHandler).toHaveBeenLastCalledWith(
            expect.objectContaining({ detail: { startDate: '2024-01-01', endDate: '2024-01-31' } })
        );
    });

    it('flags an error and does not emit change once start is moved after end', () => {
        const element = createPicker();
        const changeHandler = jest.fn();
        element.addEventListener('change', changeHandler);

        const [startInput, endInput] = element.shadowRoot.querySelectorAll('lightning-input');
        endInput.dispatchEvent(new CustomEvent('change', { detail: { value: '2024-01-01' } }));
        changeHandler.mockClear(); // that first change (end date alone) is valid; only the next one matters here

        startInput.dispatchEvent(new CustomEvent('change', { detail: { value: '2024-02-01' } }));

        expect(changeHandler).not.toHaveBeenCalled();
        return Promise.resolve().then(() => {
            expect(element.shadowRoot.textContent).toContain('Start date must be on or before the end date.');
        });
    });

    it('a "Today" preset sets both dates to the same ISO date', () => {
        // Spying on Date.now() alone doesn't affect `new Date()` with no args (a
        // real gotcha - they aren't implemented in terms of each other); fake
        // timers with a set system time affect both.
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-06-15T12:00:00Z'));
        const element = createPicker();
        const changeHandler = jest.fn();
        element.addEventListener('change', changeHandler);

        const todayButton = Array.from(element.shadowRoot.querySelectorAll('lightning-button')).find(
            (b) => b.label === 'Today'
        );
        todayButton.click();
        jest.useRealTimers();

        expect(changeHandler).toHaveBeenCalledWith(
            expect.objectContaining({ detail: { startDate: '2024-06-15', endDate: '2024-06-15' } })
        );
    });

    it('hides the preset buttons when hidePresets is true', () => {
        const element = createPicker({ hidePresets: true });
        expect(element.shadowRoot.querySelectorAll('lightning-button')).toHaveLength(0);
    });

    // Jest gives @salesforce/i18n/timeZone the value America/Los_Angeles, so these run in that zone,
    // whatever time zone the machine running the tests is in.
    describe("presets follow the user's Salesforce time zone", () => {
        function at(instant) {
            jest.useFakeTimers();
            jest.setSystemTime(new Date(instant));
        }

        function pressPreset(element, label) {
            const handler = jest.fn();
            element.addEventListener('change', handler);
            Array.from(element.shadowRoot.querySelectorAll('lightning-button'))
                .find((button) => button.label === label)
                .click();
            return handler.mock.calls[handler.mock.calls.length - 1][0].detail;
        }

        afterEach(() => {
            jest.useRealTimers();
        });

        it.each([
            ['Today', '2026-10-31', '2026-10-31'],
            ['Last 7 Days', '2026-10-25', '2026-10-31'],
            ['Last 30 Days', '2026-10-02', '2026-10-31'],
            ['This Month', '2026-10-01', '2026-10-31'],
            ['Last Month', '2026-09-01', '2026-09-30']
        ])('%s at 1pm on 31 October', (label, startDate, endDate) => {
            at('2026-10-31T20:00:00Z');

            expect(pressPreset(createPicker(), label)).toEqual({ startDate, endDate });
        });

        it('still says today, not tomorrow, late in the evening when UTC has already moved on', () => {
            at('2026-11-01T04:30:00Z'); // 9:30pm on 31 October in Los Angeles

            expect(pressPreset(createPicker(), 'Today')).toEqual({ startDate: '2026-10-31', endDate: '2026-10-31' });
        });

        it('counts seven calendar days across the end of daylight saving time', () => {
            at('2026-11-03T18:00:00Z'); // the clocks went back on 1 November

            expect(pressPreset(createPicker(), 'Last 7 Days')).toEqual({ startDate: '2026-10-28', endDate: '2026-11-03' });
        });

        it('reaches back into the previous year for last month in January', () => {
            at('2027-01-15T18:00:00Z');

            expect(pressPreset(createPicker(), 'Last Month')).toEqual({ startDate: '2026-12-01', endDate: '2026-12-31' });
        });

        it('knows February has 29 days in a leap year', () => {
            at('2028-03-10T18:00:00Z');

            expect(pressPreset(createPicker(), 'Last Month')).toEqual({ startDate: '2028-02-01', endDate: '2028-02-29' });
        });
    });
});
