/**
 * Page-by-page browsing past SOQL's 2,000-row OFFSET limit, in any sort order, using an Apex
 * pagination cursor (Database.PaginationCursor, Spring '26 / API 66.0). It takes the same
 * arguments and returns the same QueryResult as GenericQueryService.query, so
 * c-enterprise-datatable switches to it with `deep-paging` and nothing else changes.
 *
 * Each call validates the request through GenericQueryService.plan (the same identifier
 * allow-listing and bound values), counts the matching rows, opens a pagination cursor
 * over the sorted query in user mode and fetches the one page asked for. A cursor is not
 * kept between calls: a page always reflects the data as it is now, like OFFSET does.
 *
 * Limits to know about:
 *  - A pagination cursor holds at most 100,000 rows, so browsing reaches the first
 *    100,000 matching records; maxPageNumber says which page that is.
 *  - Every call opens one cursor, and an org can open 200,000 pagination cursors a day.
 *  - This class is the only part of the toolkit that needs API 66.0.
 */
public with sharing class CursorPagingService {
    public static final Integer MAX_ROWS = 100000;

    @AuraEnabled
    public static QueryResult queryPage(
        String objectApiName,
        List<String> fields,
        List<QueryFilter> filters,
        String sortField,
        String sortDirection,
        String searchTerm,
        List<String> searchFields,
        Integer pageNumber,
        Integer pageSize
    ) {
        try {
            GenericQueryService.QueryPlan queryPlan = GenericQueryService.plan(
                objectApiName,
                fields,
                filters,
                sortField,
                sortDirection,
                searchTerm,
                searchFields
            );

            Integer safePageSize = GenericQueryService.normalizePageSize(pageSize);
            Integer safePageNumber = (pageNumber == null || pageNumber < 1) ? 1 : pageNumber;
            Integer maxPageNumber = maxPageNumber(safePageSize);
            if (safePageNumber > maxPageNumber) {
                throw new GenericQueryService.QueryServiceException(
                    'Page ' + safePageNumber + ' is past the first ' + MAX_ROWS.format() +
                    ' records, which is as far as page-by-page browsing can reach. Narrow the search or filters to find the rest.'
                );
            }

            Integer totalCount = Database.countQueryWithBinds(queryPlan.countQuery(), queryPlan.binds, AccessLevel.USER_MODE);
            Integer start = (safePageNumber - 1) * safePageSize;
            List<SObject> records = new List<SObject>();

            if (start < Math.min(totalCount, MAX_ROWS)) {
                Map<String, Object> binds = queryPlan.binds.clone();
                String soql = queryPlan.selectQuery();
                // A cursor cannot hold more than MAX_ROWS rows; only cap the query when it would.
                if (totalCount > MAX_ROWS) {
                    soql += ' LIMIT :rowCap';
                    binds.put('rowCap', MAX_ROWS);
                }
                Database.PaginationCursor cursor = Database.getPaginationCursorWithBinds(soql, binds, AccessLevel.USER_MODE);
                // Rows can be deleted between the count and the cursor, so trust the cursor's own size.
                Integer available = cursor.getNumRecords();
                if (start < available) {
                    records = cursor.fetchPage(start, Math.min(safePageSize, available - start)).getRecords();
                }
            }

            return new QueryResult(records, totalCount, safePageNumber, safePageSize, maxPageNumber);
        } catch (GenericQueryService.QueryServiceException qse) {
            throw toAuraException(qse.getMessage());
        } catch (Exception e) {
            throw toAuraException('Unable to run query: ' + e.getMessage());
        }
    }

    /** The last page that starts inside the first MAX_ROWS rows. */
    @TestVisible
    private static Integer maxPageNumber(Integer pageSize) {
        return (MAX_ROWS + pageSize - 1) / pageSize;
    }

    // AuraHandledException hides its message from getMessage() unless setMessage is called.
    private static AuraHandledException toAuraException(String message) {
        AuraHandledException ex = new AuraHandledException(message);
        ex.setMessage(message);
        return ex;
    }
}
