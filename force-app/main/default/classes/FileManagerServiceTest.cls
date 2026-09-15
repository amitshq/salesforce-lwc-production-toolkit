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
