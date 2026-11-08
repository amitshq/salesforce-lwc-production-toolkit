@IsTest
private class FileManagerServiceTest {
    @IsTest
    static void listsFilesLinkedToARecord() {
        Account account = new Account(Name = 'File Test');
        insert account;
        ContentVersion version = new ContentVersion(
            Title = 'Test File',
            PathOnClient = 'test.txt',
            VersionData = Blob.valueOf('Hello'),
            FirstPublishLocationId = account.Id
        );
        insert version;

        Test.startTest();
        List<FileManagerService.FileInfo> files = FileManagerService.getFilesForRecord(account.Id);
        Test.stopTest();

        System.assertEquals(1, files.size());
        System.assertEquals('Test File', files[0].title);
        System.assertEquals('txt', files[0].fileExtension);
    }

    @IsTest
    static void deletesAFile() {
        Account account = new Account(Name = 'File Test 2');
        insert account;
        ContentVersion version = new ContentVersion(
            Title = 'To Delete',
            PathOnClient = 'delete.txt',
            VersionData = Blob.valueOf('Bye'),
            FirstPublishLocationId = account.Id
        );
        insert version;
        Id contentDocumentId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :version.Id].ContentDocumentId;

        Test.startTest();
        FileManagerService.deleteFile(contentDocumentId);
        Test.stopTest();

        System.assertEquals(0, [SELECT COUNT() FROM ContentDocument WHERE Id = :contentDocumentId]);
    }

    private static Id uploadTo(Id recordId, String title) {
        ContentVersion version = new ContentVersion(
            Title = title,
            PathOnClient = title + '.txt',
            VersionData = Blob.valueOf('content'),
            FirstPublishLocationId = recordId
        );
        insert version;
        return [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :version.Id].ContentDocumentId;
    }

    @IsTest
    static void removingAFileThatIsAttachedElsewhereOnlyUnlinksIt() {
        Account first = new Account(Name = 'Remove Test A');
        Account second = new Account(Name = 'Remove Test B');
        insert new List<Account>{ first, second };
        Id documentId = uploadTo(first.Id, 'Shared');
        insert new ContentDocumentLink(ContentDocumentId = documentId, LinkedEntityId = second.Id, ShareType = 'V');

        Test.startTest();
        String outcome = FileManagerService.removeFileFromRecord(documentId, first.Id);
        Test.stopTest();

        System.assertEquals('unlinked', outcome);
        System.assertEquals(1, [SELECT COUNT() FROM ContentDocument WHERE Id = :documentId], 'The file must survive: it is still on the other record.');
        System.assertEquals(0, [SELECT COUNT() FROM ContentDocumentLink WHERE ContentDocumentId = :documentId AND LinkedEntityId = :first.Id]);
        System.assertEquals(1, [SELECT COUNT() FROM ContentDocumentLink WHERE ContentDocumentId = :documentId AND LinkedEntityId = :second.Id]);
    }

    @IsTest
    static void removingAFileFromItsOnlyRecordDeletesIt() {
        // The uploader's own library link must not count as "attached elsewhere".
        Account account = new Account(Name = 'Remove Test C');
        insert account;
        Id documentId = uploadTo(account.Id, 'Only Here');

        Test.startTest();
        String outcome = FileManagerService.removeFileFromRecord(documentId, account.Id);
        Test.stopTest();

        System.assertEquals('deleted', outcome);
        System.assertEquals(0, [SELECT COUNT() FROM ContentDocument WHERE Id = :documentId]);
    }

    @IsTest
    static void refusesAFileThatIsNotOnTheRecord() {
        Account first = new Account(Name = 'Remove Test D');
        Account second = new Account(Name = 'Remove Test E');
        insert new List<Account>{ first, second };
        Id documentId = uploadTo(first.Id, 'Elsewhere');

        String message = null;
        try {
            FileManagerService.removeFileFromRecord(documentId, second.Id);
        } catch (AuraHandledException ex) {
            message = ex.getMessage();
        }

        System.assertNotEquals(null, message);
        System.assert(message.contains('not attached to this record'), message);
        System.assertEquals(1, [SELECT COUNT() FROM ContentDocument WHERE Id = :documentId], 'Nothing was deleted.');
    }

    @IsTest
    static void removingNeedsBothIds() {
        String message = null;
        try {
            FileManagerService.removeFileFromRecord(null, null);
        } catch (AuraHandledException ex) {
            message = ex.getMessage();
        }

        System.assertNotEquals(null, message);
        System.assert(message.contains('required'), message);
    }

    @IsTest
    static void throwsAuraHandledExceptionForMissingRecordId() {
        Boolean threw = false;
        try {
            FileManagerService.getFilesForRecord(null);
        } catch (AuraHandledException ex) {
            threw = true;
        }
        System.assertEquals(true, threw);
    }

    @IsTest
    static void throwsAuraHandledExceptionForMissingContentDocumentId() {
        Boolean threw = false;
        try {
            FileManagerService.deleteFile(null);
        } catch (AuraHandledException ex) {
            threw = true;
        }
        System.assertEquals(true, threw);
    }
}
