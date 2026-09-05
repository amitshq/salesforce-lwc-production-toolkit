import getRecordsApex from '@salesforce/apex/CustomMetadataService.getRecords';
import getRecordByDeveloperNameApex from '@salesforce/apex/CustomMetadataService.getRecordByDeveloperName';
import { getMetadataRecords, getMetadataRecordByDeveloperName, clearMetadataCache } from 'c/metadataUtils';

jest.mock('@salesforce/apex/CustomMetadataService.getRecords', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/CustomMetadataService.getRecordByDeveloperName', () => ({ default: jest.fn() }), {
    virtual: true
});

describe('metadataUtils', () => {
    beforeEach(() => {
        clearMetadataCache();
        jest.clearAllMocks();
    });

    it('getMetadataRecords resolves with the Apex result', async () => {
        getRecordsApex.mockResolvedValue([{ DeveloperName: 'Default', IsEnabled__c: true }]);

        const result = await getMetadataRecords('ToolkitDemoSetting__mdt', ['IsEnabled__c']);

        expect(result).toEqual([{ DeveloperName: 'Default', IsEnabled__c: true }]);
        expect(getRecordsApex).toHaveBeenCalledWith({
            metadataApiName: 'ToolkitDemoSetting__mdt',
            fieldNames: ['IsEnabled__c']
        });
    });

    it('caches by metadata type and field set, ignoring field order', async () => {
        getRecordsApex.mockResolvedValue([]);

        await getMetadataRecords('ToolkitDemoSetting__mdt', ['IsEnabled__c', 'Description__c']);
        await getMetadataRecords('ToolkitDemoSetting__mdt', ['Description__c', 'IsEnabled__c']);

        expect(getRecordsApex).toHaveBeenCalledTimes(1);
    });

    it('getMetadataRecordByDeveloperName is cached independently per developer name', async () => {
        getRecordByDeveloperNameApex.mockResolvedValue({ DeveloperName: 'Default' });

        await getMetadataRecordByDeveloperName('ToolkitDemoSetting__mdt', 'Default', ['IsEnabled__c']);
        await getMetadataRecordByDeveloperName('ToolkitDemoSetting__mdt', 'Default', ['IsEnabled__c']);
        await getMetadataRecordByDeveloperName('ToolkitDemoSetting__mdt', 'Other', ['IsEnabled__c']);

        expect(getRecordByDeveloperNameApex).toHaveBeenCalledTimes(2);
    });

    it('clearMetadataCache forces a reload', async () => {
        getRecordsApex.mockResolvedValue([]);

        await getMetadataRecords('ToolkitDemoSetting__mdt', []);
        clearMetadataCache();
        await getMetadataRecords('ToolkitDemoSetting__mdt', []);

        expect(getRecordsApex).toHaveBeenCalledTimes(2);
    });
});
