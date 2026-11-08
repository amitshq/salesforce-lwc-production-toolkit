# Changelog

Notable changes, newest first. Dates are UTC. The website's banner and release timer read
[`docs/releases.js`](docs/releases.js), not this file; update both when you cut a release (see [RELEASING.md](RELEASING.md)).

## [Unreleased]

### Added

- **Clipboard helpers.** `clipboardUtils` copies text with the Clipboard API and falls back to a hidden textarea where the API is missing or refuses. The fallback restores focus (through shadow roots), always removes the textarea, never throws, can place the textarea in a caller's container (for a focus-trapped modal), and refuses empty text instead of wiping the user's clipboard. `copyValue` trims and copies an array one item per line.
- **`c-copy-button`.** A copy button that confirms itself: a check-mark icon, a toast (de-duplicated), a screen-reader message, and `copied` / `copyerror` events. It is disabled while there is nothing to copy.
- A **Copy Ids** bulk action in the datatable demo.

### Changed

- **A simpler README.** It now goes from clone to running demo in a few lines, shows the one table component and the attributes that switch features on, and folds the full list of pieces into collapsible groups by goal. That list is generated from `docs/catalog.js` and `docs/goals.js` (`npm run docs:readme`), and `npm run test:site` fails if it goes stale.
- **A simpler, more hands-on website.** A shorter page with a "Try it" playground that mocks the newest features: conflict detection (with a button that plays a colleague changing a record), live refresh, a column chooser, saved views that survive a reload, and Copy Ids, plus a checklist that ticks off as you try each one. Pieces are found by what you want to do, not by code category. Usage snippets in the catalog copy with one click.
- The test-count badge and counts are gone from the README and website, since they went stale with every change.

### Fixed

- **The demo never showed its Delete action.** `c-enterprise-datatable` read `enable-bulk-delete` only when it first loaded, and the demo turns it on once a permission check returns. The flag now works whenever it is set, and a `page-size` set after loading reloads from page 1.
- **Date presets were a day off for users ahead of UTC.** In India, "This Month" started on the last day of the previous month, and in Los Angeles after 5pm "Today" meant tomorrow. Presets now use the user's Salesforce time zone and calendar-date arithmetic.
- **Searching for "O'Brien" found nothing.** The search term was escaped although it is a bind variable. Typed `%` and `_` are now matched literally too.
- **Paging could repeat or skip rows, and broke past row 2,000.** Results now end with an Id tiebreaker, and a page beyond SOQL's 2,000-row OFFSET limit is refused with a clear message; the table stops paging there and says how many records can be reached (`QueryResult.maxPageNumber`).
- **`c-modal` trapped keyboard users on its close button.** Its focus trap never saw slotted content. Focus is now kept in with focus guards that let Tab move through the slotted body and footer, wrapping at the ends.
- **`deleteRecords` would delete any Id it was given.** Ids of another object than the one named are now refused.
- **Removing a file deleted it everywhere.** `c-file-upload-manager` now uses `FileManagerService.removeFileFromRecord`, which only unlinks a file that is still attached elsewhere.
- **Fourteen JS-only modules had no `js-meta.xml`**, which Salesforce documents as required to deploy a component; `npm run test:site` now checks every bundle has one.
- **There was no LICENSE file** although the site said MIT; added, with the `package.json` license field.
- **The Apex CI could not run.** It now logs in with JWT (or an auth URL), runs on pushes to `dev`, manual runs and `run-apex`-labelled pull requests, keeps JUnit results and fails under 85% coverage. It still needs Dev Hub credentials to run; see RELEASING.md.
- The website's "Get started" steps no longer make the page scroll sideways on a phone, and the phone navigation takes one row instead of a quarter of the screen.

## [2.0.0] - 2026-10-17

### Added

- **Conflict-safe saves.** `c-enterprise-datatable` takes `enable-conflict-detection`: an inline edit sends the `SystemModstamp` it was loaded with, and `GenericDmlService` rejects the row (`DmlResult.isConflict`) instead of overwriting a newer change. It is a compare-then-write check, not a lock, and is skipped for objects without `SystemModstamp`.
- **CSV import wizard.** `c-csv-import-wizard` uploads a CSV, maps its columns to fields, reviews problems row by row and imports in chunks through `GenericDmlService`, so a bad row is reported by its row number instead of failing the file. The logic lives in `csvImportEngine`; `csvUtils` gains an RFC 4180 `parseCsv` / `parseCsvTable`.
- **Aggregate KPIs.** `GenericAggregateService` runs COUNT, SUM, AVG, MIN and MAX with optional GROUP BY, using the same identifier allow-listing, bound values and user-mode execution as `GenericQueryService`. `c-aggregate-kpi-card` wraps `c-kpi-card`, computes its own number, and can show a percentage-change trend from `comparison-filters`.
- **Saved views.** Per-user named layouts (visible columns, sort, search, filters) with a default view, set with `view-key`. Backed by the Private `ToolkitSavedView__c` object and `SavedViewService`; `c-datatable-view-bar` is the toolbar. The datatable gains `currentConfig` and `applyConfig(config)`.
- **Column chooser.** `enable-column-chooser` lets each user hide and show columns (`c-column-chooser`).
- **Live refresh.** `auto-refresh` follows Change Data Capture events for the object (`empUtils`). It reloads quietly only when nothing is being edited or selected and the table is in page mode; otherwise it shows a "records changed" bar. Changes from the table's own saves are ignored.
- **Website.** A "what's new" banner with a live "live for N days" timer, a release timeline with a countdown to the next version, feature cards linking to the catalog, a KPI strip in the live demo, and a catalog that now covers every component and Apex service. `?previewNow=+3d` previews the page at another time.
- **Tooling.** CI (lint, Jest and the website checks) on pull requests to `dev`; an opt-in scratch-org Apex workflow; unlocked-package metadata; `CONTRIBUTING.md` and `RELEASING.md`; a workflow that closes pull requests aimed at `main`.
- **Components added after 1.0.0.** Multi-select lookup, dynamic filter panel, dynamic form, pagination, file upload manager, image gallery, permission gate, feature gate, KPI card, date range picker, `lmsUtils` with a message channel, keyset pagination (`GenericQueryService.queryWithCursor`) and `FileManagerService`; `csvUtils` CSV export (pull request #2).

### Changed

- `GenericQueryService.describeObject`, `allowListSingleField` and `buildFilterClauses` are now `public`, and `resolveField` returns the validated path together with the last field's describe, so other services share one validator.
- `DmlRecordInput` gains `expectedModstamp`; `DmlResult` gains `isConflict` and `modstamp`.
- The datatable's search box and column filter inputs are now bound to its state, so a restored view is visible in them.
- `LWCToolkitAdmin` grants `GenericAggregateService`, `SavedViewService` and the `ToolkitSavedView__c` object and fields.

### Fixed

- Relationship paths such as `Owner.Name` were silently dropped by `GenericQueryService` (the field map is keyed by `ownerid`, not `owner`), including the Owner column in the demo. Relationship names now resolve to their lookup fields.
- Sorting a relationship column sent the flattened alias (`Owner_Name`) to the server as the sort field.
- `csvUtils`: an action column no longer crashes an export; exported text is protected against spreadsheet formula injection; a UTF-8 BOM and CRLF line endings make files open correctly in Excel.

### Upgrading from 1.0.0

- Deploy again and re-assign `LWCToolkitAdmin`. If you grant access through your own permission set, add the `GenericAggregateService` and `SavedViewService` classes and the `ToolkitSavedView__c` object and fields (create, read, edit, delete) to it.
- `view-key` needs the new `ToolkitSavedView__c` object. Without it the view bar reports an error and the table still loads.
- `auto-refresh` needs Change Data Capture enabled for the object (Setup, Integrations, Change Data Capture). Without it the table fires `liveerror` and carries on without live updates.
- The Apex added in this release (aggregates, saved views, conflict detection) ships with test classes but has not yet been run in an org. Run `sf apex run test` in a scratch org before relying on it.

## [1.0.0] - 2026-09-05

### Added

- `c-enterprise-datatable`: server-side query, pagination (pages or infinite scroll), sorting, per-column filtering, search, multi-select with bulk actions and bulk delete, inline editing with bulk save and per-row partial errors.
- The generic Apex layer: `GenericQueryService`, `GenericDmlService`, `PermissionService`, `CustomMetadataService`.
- UX components: modal framework, confirmation dialog, toast manager, loading, empty and error states, wizard.
- Utility modules: debounce and throttle, deep clone and comparison, nested access, JSON and URL helpers, Apex and LDS error parsers, navigation, record refresh, permission checks and a custom-metadata loader.
- An Account demo, a GitHub Pages site and a usage guide (the site and guide followed the next day).
