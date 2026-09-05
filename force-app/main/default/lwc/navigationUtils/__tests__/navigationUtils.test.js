import { NavigationMixin } from 'lightning/navigation';
import {
    navigateToRecord,
    navigateToNewRecord,
    navigateToObjectHome,
    navigateToListView,
    navigateToRelatedList,
    navigateToTab,
    navigateToWebPage,
    generateRecordUrl
} from 'c/navigationUtils';

function createFakeComponent() {
    return {
        [NavigationMixin.Navigate]: jest.fn(),
        [NavigationMixin.GenerateUrl]: jest.fn(() => Promise.resolve('/generated/url'))
    };
}

describe('navigationUtils', () => {
    it('navigateToRecord builds a standard__recordPage reference', () => {
        const component = createFakeComponent();
        navigateToRecord(component, '001xx0000000001', 'Account');

        expect(component[NavigationMixin.Navigate]).toHaveBeenCalledWith({
            type: 'standard__recordPage',
            attributes: { recordId: '001xx0000000001', objectApiName: 'Account', actionName: 'view' }
        });
    });

    it('navigateToNewRecord passes default field values through the state param', () => {
        const component = createFakeComponent();
        navigateToNewRecord(component, 'Account', { Name: 'Acme, Inc' });

        expect(component[NavigationMixin.Navigate]).toHaveBeenCalledWith({
            type: 'standard__objectPage',
            attributes: { objectApiName: 'Account', actionName: 'new' },
            state: { defaultFieldValues: 'Name=Acme%2C%20Inc' }
        });
    });

    it('navigateToObjectHome builds a standard__objectPage reference', () => {
        const component = createFakeComponent();
        navigateToObjectHome(component, 'Account');

        expect(component[NavigationMixin.Navigate]).toHaveBeenCalledWith({
            type: 'standard__objectPage',
            attributes: { objectApiName: 'Account', actionName: 'home' }
        });
    });

    it('navigateToListView includes the requested list view as filterName', () => {
        const component = createFakeComponent();
        navigateToListView(component, 'Account', 'MyListView');

        expect(component[NavigationMixin.Navigate]).toHaveBeenCalledWith({
            type: 'standard__objectPage',
            attributes: { objectApiName: 'Account', actionName: 'list' },
            state: { filterName: 'MyListView' }
        });
    });

    it('navigateToRelatedList builds a standard__recordRelationshipPage reference', () => {
        const component = createFakeComponent();
        navigateToRelatedList(component, '001xx0000000001', 'Account', 'Contacts');

        expect(component[NavigationMixin.Navigate]).toHaveBeenCalledWith({
            type: 'standard__recordRelationshipPage',
            attributes: {
                recordId: '001xx0000000001',
                objectApiName: 'Account',
                relationshipApiName: 'Contacts',
                actionName: 'view'
            }
        });
    });

    it('navigateToTab builds a standard__navItemPage reference', () => {
        const component = createFakeComponent();
        navigateToTab(component, 'My_Custom_Tab');

        expect(component[NavigationMixin.Navigate]).toHaveBeenCalledWith({
            type: 'standard__navItemPage',
            attributes: { apiName: 'My_Custom_Tab' }
        });
    });

    it('navigateToWebPage builds a standard__webPage reference', () => {
        const component = createFakeComponent();
        navigateToWebPage(component, 'https://example.com');

        expect(component[NavigationMixin.Navigate]).toHaveBeenCalledWith({
            type: 'standard__webPage',
            attributes: { url: 'https://example.com' }
        });
    });

    it('generateRecordUrl resolves the href without navigating', async () => {
        const component = createFakeComponent();
        const url = await generateRecordUrl(component, '001xx0000000001', 'Account');

        expect(url).toBe('/generated/url');
        expect(component[NavigationMixin.Navigate]).not.toHaveBeenCalled();
    });
});
