import { showToast, showSuccessToast, showErrorToast, clearToastDedupeState } from 'c/toastService';

function createFakeComponent() {
    return { dispatchEvent: jest.fn() };
}

describe('toastService', () => {
    beforeEach(() => {
        clearToastDedupeState();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('dispatches a ShowToastEvent with the given fields', () => {
        const component = createFakeComponent();
        showToast(component, { title: 'Saved', message: 'Record updated', variant: 'success' });

        expect(component.dispatchEvent).toHaveBeenCalledTimes(1);
        const event = component.dispatchEvent.mock.calls[0][0];
        expect(event.detail).toMatchObject({ title: 'Saved', message: 'Record updated', variant: 'success' });
    });

    it('showSuccessToast defaults variant to success and title to "Success"', () => {
        const component = createFakeComponent();
        showSuccessToast(component, 'All good');

        const event = component.dispatchEvent.mock.calls[0][0];
        expect(event.detail).toMatchObject({ title: 'Success', message: 'All good', variant: 'success' });
    });

    it('showErrorToast joins an array of messages and uses a sticky mode', () => {
        const component = createFakeComponent();
        showErrorToast(component, ['First problem', 'Second problem']);

        const event = component.dispatchEvent.mock.calls[0][0];
        expect(event.detail).toMatchObject({
            title: 'Error',
            message: 'First problem Second problem',
            variant: 'error',
            mode: 'sticky'
        });
    });

    it('suppresses an identical toast fired again within the de-duplication window', () => {
        const component = createFakeComponent();
        jest.spyOn(Date, 'now').mockReturnValue(1000);

        showToast(component, { title: 'Error', message: 'Same failure', variant: 'error' });
        showToast(component, { title: 'Error', message: 'Same failure', variant: 'error' });

        expect(component.dispatchEvent).toHaveBeenCalledTimes(1);
    });

    it('allows the identical toast again once the window has elapsed', () => {
        const component = createFakeComponent();
        const nowSpy = jest.spyOn(Date, 'now');

        nowSpy.mockReturnValue(1000);
        showToast(component, { title: 'Error', message: 'Same failure', variant: 'error' });

        nowSpy.mockReturnValue(10000);
        showToast(component, { title: 'Error', message: 'Same failure', variant: 'error' });

        expect(component.dispatchEvent).toHaveBeenCalledTimes(2);
    });

    it('allowDuplicate bypasses de-duplication', () => {
        const component = createFakeComponent();
        jest.spyOn(Date, 'now').mockReturnValue(1000);

        showToast(component, { title: 'Error', message: 'Same failure', variant: 'error', allowDuplicate: true });
        showToast(component, { title: 'Error', message: 'Same failure', variant: 'error', allowDuplicate: true });

        expect(component.dispatchEvent).toHaveBeenCalledTimes(2);
    });
});
