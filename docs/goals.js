/* What you might be trying to do, and the catalog entries that help. One source for the website's filter
   buttons and the "What's inside" list in the README (npm run docs:readme regenerates it). Every catalog
   entry must appear in at least one goal; npm run test:site checks that. Loaded by the page
   (window.TOOLKIT_GOALS) and by the Node checks. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TOOLKIT_GOALS = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  return [
    {
      id: 'tables',
      label: 'Show records in a table',
      blurb: 'A server-side table with paging, sorting, filters, inline edit, saved views and bulk actions.',
      ids: [
        'enterprise-datatable',
        'column-chooser',
        'datatable-view-bar',
        'pagination',
        'infinite-scroll-loader',
        'bulk-action-bar',
        'generic-query-service',
        'generic-dml-service',
        'saved-view-service-apex'
      ]
    },
    {
      id: 'import',
      label: 'Import and export CSV',
      blurb: 'Bring a CSV in with row-by-row errors, and send one out without spreadsheet formula surprises.',
      ids: ['csv-import-wizard', 'csv-import-engine', 'csv-utils']
    },
    {
      id: 'numbers',
      label: 'Show numbers and KPIs',
      blurb: 'KPI tiles and aggregates (count, sum, average, min, max) computed on the server.',
      ids: ['aggregate-kpi-card', 'kpi-card', 'generic-aggregate-service', 'date-range-picker']
    },
    {
      id: 'forms',
      label: 'Forms, lookups and files',
      blurb: 'Forms from a config array, record pickers, step-by-step wizards, and file upload and viewing.',
      ids: [
        'dynamic-form',
        'multi-select-lookup',
        'dynamic-filter-panel',
        'wizard',
        'file-upload-manager',
        'image-gallery',
        'file-manager-service-apex'
      ]
    },
    {
      id: 'feedback',
      label: 'Dialogs, toasts and states',
      blurb: 'Modals, confirmations, toasts, loading, empty and error states, and a copy button that confirms itself.',
      ids: ['modal', 'confirm-dialog', 'toast-service', 'state-manager', 'empty-state', 'error-state', 'copy-button']
    },
    {
      id: 'access',
      label: 'Access and settings',
      blurb: 'Show or hide things by permission or feature flag, and read org settings from custom metadata.',
      ids: [
        'permission-gate',
        'feature-gate',
        'permission-utils',
        'permission-service-apex',
        'metadata-utils',
        'custom-metadata-service-apex'
      ]
    },
    {
      id: 'platform',
      label: 'Talk to the platform',
      blurb: 'Change Data Capture, Lightning Message Service, navigation and record refresh.',
      ids: ['emp-utils', 'lms-utils', 'navigation-utils', 'record-utils']
    },
    {
      id: 'helpers',
      label: 'Everyday helpers',
      blurb: 'Debounce, deep clone, JSON, URLs, the clipboard, and turning Apex and LDS errors into messages.',
      ids: ['function-utils', 'object-utils', 'json-utils', 'url-utils', 'clipboard-utils', 'apex-error-utils', 'lds-error-utils']
    }
  ];
});
