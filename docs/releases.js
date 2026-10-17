/* Release data behind the website's "what's new" banner, feature cards and release timeline.
   This is the one file to edit when you cut a release (see RELEASING.md):
     - current.releasedAt  the moment you publish; every "Live for N days" counts from it
     - current.version     a new version brings the dismissed banner back
     - upcoming            the next version, its target date and what is planned for it
   Dates are ISO 8601 in UTC. Loaded by the page (window.TOOLKIT_RELEASES) and by release-timer.check.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TOOLKIT_RELEASES = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    current: {
      version: '2.0.0',
      releasedAt: '2026-10-17T12:00:00Z',
      headline: 'Six new features for production tables',
      summary:
        'Conflict-safe saves, a CSV import wizard, aggregate KPIs, saved views, a column chooser and live refresh - each with tests, docs and a place in the demo.',
      notesUrl: 'https://github.com/amitshq/salesforce-lwc-production-toolkit/blob/main/CHANGELOG.md',
      highlights: [
        {
          id: 'conflict-safe-saves',
          title: 'Conflict-safe saves',
          summary:
            "An inline edit is checked against the record's SystemModstamp, so a stale edit is rejected with a clear message instead of silently overwriting a colleague's change.",
          catalogIds: ['enterprise-datatable', 'generic-dml-service']
        },
        {
          id: 'csv-import',
          title: 'CSV import wizard',
          summary:
            'Upload, map columns, review the problems row by row, then import in chunks. A bad row is reported by its row number instead of failing the whole file.',
          catalogIds: ['csv-import-wizard', 'csv-import-engine', 'csv-utils']
        },
        {
          id: 'aggregate-kpis',
          title: 'Aggregate KPIs',
          summary:
            'COUNT, SUM, AVG, MIN and MAX with GROUP BY, computed server-side with the same safety model - plus a KPI card that fetches its own number and trend.',
          catalogIds: ['aggregate-kpi-card', 'generic-aggregate-service']
        },
        {
          id: 'saved-views',
          title: 'Saved views',
          summary:
            'Per-user named layouts - columns, sort, search and filters - with a default view that opens automatically, stored privately for each user.',
          catalogIds: ['datatable-view-bar', 'saved-view-service-apex', 'enterprise-datatable']
        },
        {
          id: 'column-chooser',
          title: 'Column chooser',
          summary: 'Each user decides which columns show. Hiding and showing is instant because every column is already loaded.',
          catalogIds: ['column-chooser', 'enterprise-datatable']
        },
        {
          id: 'live-refresh',
          title: 'Live refresh',
          summary:
            'The table follows changes made elsewhere through Change Data Capture - and never discards an edit in progress to do it.',
          catalogIds: ['emp-utils', 'enterprise-datatable']
        }
      ]
    },

    history: [
      {
        version: '1.0.0',
        releasedAt: '2026-09-05T12:00:00Z',
        headline: 'First release',
        summary: 'The generic server-side datatable, modal framework, error and state handling, and the shared utility modules.'
      }
    ],

    // The next version. These are plans, not promises: edit freely, or set upcoming to null when nothing is planned.
    upcoming: {
      version: '2.1.0',
      targetAt: '2026-11-14T12:00:00Z',
      headline: 'Planned for the next release',
      items: [
        { title: 'Date-grouped aggregates', summary: 'Group KPIs by day, month or quarter.' },
        { title: 'Record-type-aware picklists', summary: 'c-dynamic-form picks up picklist values for the record type.' },
        { title: 'Keyset paging in the datatable', summary: 'Use the cursor query behind infinite scroll for very large tables.' },
        { title: 'Import by external Id', summary: 'Upsert from the CSV wizard instead of insert-or-update by Salesforce Id.' }
      ]
    }
  };
});
