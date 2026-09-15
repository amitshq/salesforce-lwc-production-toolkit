/**
 * Reads and deletes files (ContentDocument) attached to a record, backing
 * c-file-upload-manager. Uploading itself is handled by the platform's own
 * `lightning-file-upload` base component - this class only covers the two
 * things it doesn't: listing what's already there, and removing one.
 */
public with sharing class FileManagerService {
    public class FileManagerServiceException extends Exception {
    }

    public class FileInfo {
        @AuraEnabled public Id contentDocumentId;
        @AuraEnabled public Id latestVersionId;
        @AuraEnabled public String title;
        @AuraEnabled public String fileExtension;
        @AuraEnabled public Integer contentSize;
        @AuraEnabled public Datetime createdDate;

        public FileInfo(ContentDocumentLink link) {
            this.contentDocumentId = link.ContentDocumentId;
            this.latestVersionId = link.ContentDocument.LatestPublishedVersionId;
            this.title = link.ContentDocument.Title;
            this.fileExtension = link.ContentDocument.FileExtension;
            this.contentSize = link.ContentDocument.ContentSize;
            this.createdDate = link.ContentDocument.CreatedDate;
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<FileInfo> getFilesForRecord(Id recordId) {
        try {
            if (recordId == null) {
                throw new FileManagerServiceException('recordId is required.');
            }
            List<ContentDocumentLink> links = [
                SELECT
                    ContentDocumentId,
                    ContentDocument.Title,
                    ContentDocument.FileExtension,
                    ContentDocument.ContentSize,
                    ContentDocument.CreatedDate,
                    ContentDocument.LatestPublishedVersionId
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :recordId
                WITH USER_MODE
                ORDER BY ContentDocument.CreatedDate DESC
            ];
            List<FileInfo> results = new List<FileInfo>();
            for (ContentDocumentLink link : links) {
                results.add(new FileInfo(link));
            }
            return results;
        } catch (FileManagerServiceException fmse) {
            throw new AuraHandledException(fmse.getMessage());
        } catch (Exception e) {
            throw new AuraHandledException('Unable to load files: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteFile(Id contentDocumentId) {
        try {
            if (contentDocumentId == null) {
                throw new FileManagerServiceException('contentDocumentId is required.');
            }
            Database.delete(new List<Id>{ contentDocumentId }, AccessLevel.USER_MODE);
        } catch (FileManagerServiceException fmse) {
            throw new AuraHandledException(fmse.getMessage());
        } catch (Exception e) {
            throw new AuraHandledException('Unable to delete file: ' + e.getMessage());
        }
    }
}
