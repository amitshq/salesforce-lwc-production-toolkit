import { createElement } from 'lwc';
import FeatureGate from 'c/featureGate';
import { getMetadataRecordByDeveloperName } from 'c/metadataUtils';

jest.mock('c/metadataUtils', () => ({
    getMetadataRecordByDeveloperName: jest.fn()
}));

function flushPromises() {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createGate(props = {}) {
    const element = createElement('c-feature-gate', { is: FeatureGate });
    element.metadataApiName = 'ToolkitDemoSetting__mdt';
    element.developerName = 'Default';
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-feature-gate', () => {
    afterEach(() => {
        jest.clearAllMocks();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('shows the default slot when the flag field is true', async () => {
        getMetadataRecordByDeveloperName.mockResolvedValue({ IsEnabled__c: true });
        const element = createGate();
        await flushPromises();

        expect(getMetadataRecordByDeveloperName).toHaveBeenCalledWith('ToolkitDemoSetting__mdt', 'Default', ['IsEnabled__c']);
        expect(element.shadowRoot.querySelector('slot:not([name])')).not.toBeNull();
        expect(element.shadowRoot.querySelector('slot[name="disabled"]')).toBeNull();
    });

    it('shows the disabled slot when the flag field is false', async () => {
        getMetadataRecordByDeveloperName.mockResolvedValue({ IsEnabled__c: false });
        const element = createGate();
        await flushPromises();

        expect(element.shadowRoot.querySelector('slot[name="disabled"]')).not.toBeNull();
    });

    it('treats a missing record as disabled', async () => {
        getMetadataRecordByDeveloperName.mockResolvedValue(null);
        const element = createGate();
        await flushPromises();

        expect(element.shadowRoot.querySelector('slot[name="disabled"]')).not.toBeNull();
    });

    it('invert flips the outcome', async () => {
        getMetadataRecordByDeveloperName.mockResolvedValue({ IsEnabled__c: true });
        const element = createGate({ invert: true });
        await flushPromises();

        expect(element.shadowRoot.querySelector('slot[name="disabled"]')).not.toBeNull();
    });

    it('a rejected lookup is treated as disabled rather than throwing', async () => {
        getMetadataRecordByDeveloperName.mockRejectedValue(new Error('boom'));
        const element = createGate();
        await flushPromises();

        expect(element.shadowRoot.querySelector('slot[name="disabled"]')).not.toBeNull();
    });

    it('respects a custom flagField name', async () => {
        getMetadataRecordByDeveloperName.mockResolvedValue({ CustomFlag__c: true });
        const element = createGate({ flagField: 'CustomFlag__c' });
        await flushPromises();

        expect(getMetadataRecordByDeveloperName).toHaveBeenCalledWith('ToolkitDemoSetting__mdt', 'Default', ['CustomFlag__c']);
        expect(element.shadowRoot.querySelector('slot:not([name])')).not.toBeNull();
    });
});
