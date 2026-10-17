@IsTest
private class SavedViewServiceTest {
    private static final String KEY = 'accounts-main';
    private static final String CONFIG = '{"v":1,"columns":["Name"],"sortedBy":"Name","sortedDirection":"asc"}';

    // Runs the permission-set assignment outside the test's own DML to avoid mixed-DML errors.
    private static void grantToolkitAccess(Id userId) {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            insert new PermissionSetAssignment(
                AssigneeId = userId,
                PermissionSetId = [SELECT Id FROM PermissionSet WHERE Name = 'LWCToolkitAdmin' LIMIT 1].Id
            );
        }
    }

    private static User createSecondUser() {
        String suffix = String.valueOf(Crypto.getRandomInteger()).replace('-', 'n');
        User other = new User(
            Alias = 'tkview',
            Email = 'tkview.' + suffix + '@example.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'SavedViewTest',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = UserInfo.getProfileId(),
            TimeZoneSidKey = 'America/Los_Angeles',
            Username = 'tkview.' + suffix + '@example.com.toolkit'
        );
        // Inserting a User after custom-object DML is only allowed inside runAs (mixed DML).
        System.runAs(new User(Id = UserInfo.getUserId())) {
            insert other;
            insert new PermissionSetAssignment(
                AssigneeId = other.Id,
                PermissionSetId = [SELECT Id FROM PermissionSet WHERE Name = 'LWCToolkitAdmin' LIMIT 1].Id
            );
        }
        return other;
    }

    @TestSetup
    static void setup() {
        grantToolkitAccess(UserInfo.getUserId());
    }

    private static String errorOf(String viewKey, String name, String config) {
        try {
            SavedViewService.saveView(viewKey, 'Account', name, config, null, null);
        } catch (AuraHandledException ex) {
            return ex.getMessage();
        }
        return null;
    }

    @IsTest
    static void savesViewsAndListsThemByName() {
        Test.startTest();
        SavedViewService.saveView(KEY, 'Account', 'Zebras', CONFIG, null, null);
        SavedViewService.saveView(KEY, 'Account', 'Apples', CONFIG, null, null);
        SavedViewService.saveView('another-table', 'Account', 'Elsewhere', CONFIG, null, null);
        List<SavedViewInfo> views = SavedViewService.getViews(KEY);
        Test.stopTest();

        System.assertEquals(2, views.size(), 'Views for another table are not included.');
        System.assertEquals('Apples', views[0].name);
        System.assertEquals('Zebras', views[1].name);
        System.assertEquals(CONFIG, views[0].config);
        System.assertEquals(false, views[0].isDefault);
    }

    @IsTest
    static void savingTheSameNameReplacesTheSettings() {
        SavedViewInfo first = SavedViewService.saveView(KEY, 'Account', 'My view', CONFIG, null, null);
        String newConfig = '{"v":1,"searchTerm":"acme"}';

        SavedViewInfo second = SavedViewService.saveView(KEY, 'Account', 'my VIEW', newConfig, null, null);

        System.assertEquals(first.id, second.id, 'Same name (case-insensitive) updates in place.');
        List<SavedViewInfo> views = SavedViewService.getViews(KEY);
        System.assertEquals(1, views.size());
        System.assertEquals(newConfig, views[0].config);
        System.assertEquals('my VIEW', views[0].name);
    }

    @IsTest
    static void updatesAndRenamesByIdButRefusesToCollideWithAnotherView() {
        SavedViewInfo first = SavedViewService.saveView(KEY, 'Account', 'First', CONFIG, null, null);
        SavedViewService.saveView(KEY, 'Account', 'Second', CONFIG, null, null);

        SavedViewInfo renamed = SavedViewService.saveView(KEY, 'Account', 'Renamed', CONFIG, null, first.id);
        System.assertEquals(first.id, renamed.id);
        System.assertEquals('Renamed', SavedViewService.getViews(KEY)[0].name);

        String message = null;
        try {
            SavedViewService.saveView(KEY, 'Account', 'second', CONFIG, null, first.id);
        } catch (AuraHandledException ex) {
            message = ex.getMessage();
        }
        System.assertNotEquals(null, message, 'Renaming onto another view must be refused.');
        System.assert(message.contains('already have a view'), message);
    }

    @IsTest
    static void keepsTheDefaultFlagWhenNoneIsSpecified() {
        SavedViewInfo created = SavedViewService.saveView(KEY, 'Account', 'Mine', CONFIG, true, null);
        System.assertEquals(true, created.isDefault);

        SavedViewService.saveView(KEY, 'Account', 'Mine', '{"v":1}', null, created.id);

        System.assertEquals(true, SavedViewService.getViews(KEY)[0].isDefault);
    }

    @IsTest
    static void keepsAtMostOneDefaultPerTable() {
        SavedViewInfo first = SavedViewService.saveView(KEY, 'Account', 'First', CONFIG, true, null);
        SavedViewInfo second = SavedViewService.saveView(KEY, 'Account', 'Second', CONFIG, true, null);
        SavedViewService.saveView('another-table', 'Account', 'Other default', CONFIG, true, null);

        List<SavedViewInfo> views = SavedViewService.getViews(KEY);
        System.assertEquals(false, views[0].isDefault, 'First lost its default when Second took it.');
        System.assertEquals(true, views[1].isDefault);
        System.assertEquals(second.id, views[1].id);
        System.assertEquals(true, SavedViewService.getViews('another-table')[0].isDefault, 'Another table keeps its own default.');
        System.assertNotEquals(first.id, second.id);
    }

    @IsTest
    static void setsAndClearsTheDefault() {
        SavedViewInfo first = SavedViewService.saveView(KEY, 'Account', 'First', CONFIG, null, null);
        SavedViewInfo second = SavedViewService.saveView(KEY, 'Account', 'Second', CONFIG, true, null);

        List<SavedViewInfo> afterSet = SavedViewService.setDefaultView(KEY, first.id);
        System.assertEquals(true, afterSet[0].isDefault);
        System.assertEquals(false, afterSet[1].isDefault);

        List<SavedViewInfo> afterClear = SavedViewService.setDefaultView(KEY, null);
        System.assertEquals(false, afterClear[0].isDefault);
        System.assertEquals(false, afterClear[1].isDefault);
        System.assertNotEquals(null, second.id);
    }

    @IsTest
    static void deletesOnlyTheNamedView() {
        SavedViewInfo first = SavedViewService.saveView(KEY, 'Account', 'First', CONFIG, null, null);
        SavedViewService.saveView(KEY, 'Account', 'Second', CONFIG, null, null);

        SavedViewService.deleteView(first.id);

        List<SavedViewInfo> views = SavedViewService.getViews(KEY);
        System.assertEquals(1, views.size());
        System.assertEquals('Second', views[0].name);
    }

    @IsTest
    static void deletingAViewThatIsGoneIsAClearError() {
        SavedViewInfo first = SavedViewService.saveView(KEY, 'Account', 'First', CONFIG, null, null);
        SavedViewService.deleteView(first.id);

        String message = null;
        try {
            SavedViewService.deleteView(first.id);
        } catch (AuraHandledException ex) {
            message = ex.getMessage();
        }
        System.assertNotEquals(null, message);
        System.assert(message.contains('no longer exists'), message);
    }

    @IsTest
    static void usersCannotSeeChangeOrDeleteEachOthersViews() {
        SavedViewInfo mine = SavedViewService.saveView(KEY, 'Account', 'Private to me', CONFIG, true, null);
        User other = createSecondUser();

        System.runAs(other) {
            System.assertEquals(0, SavedViewService.getViews(KEY).size(), 'The other user sees none of my views.');

            String updateMessage = null;
            try {
                SavedViewService.saveView(KEY, 'Account', 'Hijacked', CONFIG, null, mine.id);
            } catch (AuraHandledException ex) {
                updateMessage = ex.getMessage();
            }
            System.assertNotEquals(null, updateMessage, 'Updating someone else\'s view by id must fail.');

            String deleteMessage = null;
            try {
                SavedViewService.deleteView(mine.id);
            } catch (AuraHandledException ex) {
                deleteMessage = ex.getMessage();
            }
            System.assertNotEquals(null, deleteMessage, 'Deleting someone else\'s view must fail.');

            SavedViewService.saveView(KEY, 'Account', 'Private to me', '{"v":1}', null, null);
            System.assertEquals(1, SavedViewService.getViews(KEY).size(), 'The same name is fine for a different user.');
        }

        List<SavedViewInfo> stillMine = SavedViewService.getViews(KEY);
        System.assertEquals(1, stillMine.size());
        System.assertEquals('Private to me', stillMine[0].name);
        System.assertEquals(CONFIG, stillMine[0].config, 'My view is unchanged.');
    }

    @IsTest
    static void capsTheNumberOfViewsPerTable() {
        List<ToolkitSavedView__c> bulk = new List<ToolkitSavedView__c>();
        for (Integer i = 0; i < 50; i++) {
            bulk.add(new ToolkitSavedView__c(Name = 'View ' + i, ViewKey__c = KEY, Config__c = CONFIG));
        }
        insert bulk;

        String message = errorOf(KEY, 'One too many', CONFIG);

        System.assertNotEquals(null, message);
        System.assert(message.contains('at most 50'), message);
    }

    @IsTest
    static void validatesInput() {
        System.assert(errorOf(null, 'Name', CONFIG).contains('view key'));
        System.assert(errorOf(KEY, '  ', CONFIG).contains('name'));
        System.assert(errorOf(KEY, 'x'.repeat(81), CONFIG).contains('80 characters'));
        System.assert(errorOf(KEY, 'Name', '').contains('needs its settings'));
        System.assert(errorOf(KEY, 'Name', '{not json').contains('not valid JSON'));
        System.assert(errorOf(KEY, 'Name', '[1,2,3]').contains('must be a JSON object'));
        System.assert(errorOf(KEY, 'Name', '{"a":"' + 'x'.repeat(30001) + '"}').contains('too large'));
        System.assertEquals(0, SavedViewService.getViews(KEY).size(), 'Nothing was saved by the rejected calls.');
    }

    @IsTest
    static void updatingAViewThatWasDeletedMeansSaveAsNew() {
        SavedViewInfo first = SavedViewService.saveView(KEY, 'Account', 'First', CONFIG, null, null);
        SavedViewService.deleteView(first.id);

        String message = null;
        try {
            SavedViewService.saveView(KEY, 'Account', 'First', CONFIG, null, first.id);
        } catch (AuraHandledException ex) {
            message = ex.getMessage();
        }
        System.assertNotEquals(null, message);
        System.assert(message.contains('no longer exists'), message);
    }
}
