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
});
