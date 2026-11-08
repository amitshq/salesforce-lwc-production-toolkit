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
            throw toAuraException(fmse.getMessage());
        } catch (Exception e) {
            throw toAuraException('Unable to load files: ' + e.getMessage());
        }
    }

    /**
     * Deletes a file everywhere it is attached, not just from one record. To take a file off a
     * single record, use removeFileFromRecord.
     */
    @AuraEnabled
    public static void deleteFile(Id contentDocumentId) {
        try {
            if (contentDocumentId == null) {
                throw new FileManagerServiceException('contentDocumentId is required.');
            }
            Database.delete(new List<Id>{ contentDocumentId }, AccessLevel.USER_MODE);
        } catch (FileManagerServiceException fmse) {
            throw toAuraException(fmse.getMessage());
        } catch (Exception e) {
            throw toAuraException('Unable to delete file: ' + e.getMessage());
        }
    }

    /**
     * Takes a file off one record. A file that is still attached to another record (or a library
     * or group) is only unlinked from this one; a file whose only home was this record is deleted.
     * @return 'unlinked' or 'deleted', so the caller can say which happened
     */
    @AuraEnabled
    public static String removeFileFromRecord(Id contentDocumentId, Id recordId) {
        try {
            if (contentDocumentId == null || recordId == null) {
                throw new FileManagerServiceException('contentDocumentId and recordId are required.');
            }
            List<ContentDocumentLink> linksToThisRecord = [
                SELECT Id
                FROM ContentDocumentLink
                WHERE ContentDocumentId = :contentDocumentId AND LinkedEntityId = :recordId
                WITH USER_MODE
                LIMIT 1
            ];
            if (linksToThisRecord.isEmpty()) {
                throw new FileManagerServiceException('That file is not attached to this record.');
            }
            if (LinkInspector.isAttachedElsewhere(contentDocumentId, recordId)) {
                Database.delete(linksToThisRecord, AccessLevel.USER_MODE);
                return 'unlinked';
            }
            Database.delete(new List<Id>{ contentDocumentId }, AccessLevel.USER_MODE);
            return 'deleted';
        } catch (FileManagerServiceException fmse) {
            throw toAuraException(fmse.getMessage());
        } catch (Exception e) {
            throw toAuraException('Unable to remove file: ' + e.getMessage());
        }
    }

    /**
     * Whether a file is attached anywhere other than the given record. It has to see links to
     * records the running user cannot see - otherwise "remove from this record" could delete a
     * file that someone else still relies on - so it runs without sharing. It answers yes or no
     * and returns no record data. Links to users (personal file libraries) do not count.
     */
    private without sharing class LinkInspector {
        public static Boolean isAttachedElsewhere(Id contentDocumentId, Id recordId) {
            for (ContentDocumentLink link : [
                SELECT LinkedEntityId
                FROM ContentDocumentLink
                WHERE ContentDocumentId = :contentDocumentId AND LinkedEntityId != :recordId
                WITH SYSTEM_MODE
            ]) {
                if (link.LinkedEntityId.getSObjectType() != User.SObjectType) {
                    return true;
                }
            }
            return false;
        }
    }

    // AuraHandledException hides its message from getMessage() unless setMessage is called.
    private static AuraHandledException toAuraException(String message) {
        AuraHandledException ex = new AuraHandledException(message);
        ex.setMessage(message);
        return ex;
    }
}
