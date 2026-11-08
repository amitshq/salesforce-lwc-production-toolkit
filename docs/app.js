/* Vanilla JS. No build step, no dependencies - this is a static GitHub Pages site. */

/* =========================================================================
   1. THEME TOGGLE
   ========================================================================= */
(function themeToggle() {
  const root = document.documentElement;
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') {
    root.setAttribute('data-theme', stored);
  }

  function currentTheme() {
    if (root.getAttribute('data-theme')) return root.getAttribute('data-theme');
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateButton(btn) {
    const isDark = currentTheme() === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  updateButton(btn);
  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateButton(btn);
  });
})();

/* =========================================================================
   2. SCROLLSPY - highlight the current section's nav link
   ========================================================================= */
(function scrollspy() {
  const links = Array.from(document.querySelectorAll('.nav .links a[href^="#"]'));
  if (!links.length) return;
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = links.find((l) => l.getAttribute('href') === `#${entry.target.id}`);
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    },
    { rootMargin: '-40% 0px -50% 0px' }
  );
  sections.forEach((section) => observer.observe(section));
})();

/* =========================================================================
   3. COPY-TO-CLIPBOARD on every code block
   ========================================================================= */
/** Copies text. Clipboard API first; a hidden textarea where it is missing or refuses (file:// pages, older browsers). */
function copyToClipboard(text) {
  function fallback() {
    const previouslyFocused = document.activeElement;
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;';
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
    }
    document.body.removeChild(field);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    return copied;
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => fallback()
    );
  }
  return Promise.resolve(fallback());
}

function wrapCodeBlocksWithCopyButtons(scope) {
  scope.querySelectorAll('pre').forEach((pre) => {
    if (pre.closest('.code-block')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-btn';
    button.textContent = 'Copy';
    button.addEventListener('click', () => {
      copyToClipboard(pre.textContent).then((copied) => {
        if (!copied) {
          button.textContent = 'Press Ctrl+C';
          return;
        }
        button.textContent = 'Copied!';
        button.classList.add('copied');
        setTimeout(() => {
          button.textContent = 'Copy';
          button.classList.remove('copied');
        }, 1500);
      });
    });
    wrapper.appendChild(button);
  });
}
wrapCodeBlocksWithCopyButtons(document);

/* =========================================================================
   4. COMPONENT / UTILITY / APEX CATALOG
   ========================================================================= */
const CATALOG = window.TOOLKIT_CATALOG; // defined in catalog.js

/* ---- render the catalog grid: filter by what you want to do ---- */
const GOALS = window.TOOLKIT_GOALS; // defined in goals.js
const grid = document.getElementById('catalogGrid');
const emptyMsg = document.getElementById('catalogEmpty');
const searchInput = document.getElementById('catalogSearch');
const pillBox = document.getElementById('filterPills');
const goalBlurb = document.getElementById('catalogBlurb');
let activeGoal = 'all';

document.getElementById('statPieces').textContent = String(CATALOG.length);

function cardHtml(item) {
  return (
    `<button type="button" class="card catalog-card" data-id="${item.id}">` +
    `<span class="kind-badge">${item.kind}</span>` +
    `<h3>${item.name}</h3>` +
    `<p>${item.tagline}</p>` +
    `<code class="path">${item.path}</code>` +
    `</button>`
  );
}

function renderPills() {
  pillBox.innerHTML = [{ id: 'all', label: 'Everything' }, ...GOALS]
    .map(
      (goal) =>
        `<button type="button" class="pill${goal.id === activeGoal ? ' active' : ''}" data-goal="${goal.id}" aria-pressed="${goal.id === activeGoal}">${goal.label}</button>`
    )
    .join('');
}

function renderCatalog() {
  const term = (searchInput.value || '').toLowerCase().trim();
  const goal = GOALS.find((candidate) => candidate.id === activeGoal);
  const pool = goal ? goal.ids.map((id) => CATALOG.find((item) => item.id === id)).filter(Boolean) : CATALOG;
  const filtered = pool.filter((item) => {
    const haystack = `${item.name} ${item.tagline} ${item.category} ${item.path}`.toLowerCase();
    return !term || haystack.includes(term);
  });
  grid.innerHTML = filtered.map(cardHtml).join('');
  emptyMsg.hidden = filtered.length !== 0;
  goalBlurb.textContent = goal ? goal.blurb : '';
}

pillBox.addEventListener('click', (event) => {
  const pill = event.target.closest('.pill');
  if (!pill) return;
  activeGoal = pill.dataset.goal;
  renderPills();
  renderCatalog();
});
searchInput.addEventListener('input', () => {
  // Searching means "look everywhere": drop a goal that would hide matches.
  if (searchInput.value.trim() && activeGoal !== 'all') {
    activeGoal = 'all';
    renderPills();
  }
  renderCatalog();
});
renderPills();
renderCatalog();

/* ---- catalog detail modal ---- */
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');
let lastFocusedBeforeModal = null;

function rowsToTable(headers, rows) {
  if (!rows || !rows.length) return '';
  const head = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c === '' ? '&mdash;' : c}</td>`).join('')}</tr>`).join('');
  return `<table>${head}${body}</table>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openCatalogModal(id) {
  const item = CATALOG.find((c) => c.id === id);
  if (!item) return;
  let html = `<span class="modal-kind">${item.kind} &middot; ${item.category}</span>`;
  html += `<h3 id="modalTitle">${item.name}</h3>`;
  html += `<p class="modal-tagline">${item.tagline}</p>`;
  // Plain <pre>: wrapCodeBlocksWithCopyButtons adds the wrapper and the Copy button.
  html += `<h4>Usage</h4><pre><code>${escapeHtml(item.usage)}</code></pre>`;
  if (item.api) {
    html += `<h4>Properties</h4>${rowsToTable(['Property', 'Type', 'Default', 'Description'], item.api)}`;
  }
  if (item.functions) {
    html += `<h4>Functions</h4>${rowsToTable(['Signature', 'Description'], item.functions)}`;
  }
  if (item.methods) {
    html += `<h4>Methods</h4>${rowsToTable(['Method', 'Returns', 'Description'], item.methods)}`;
  }
  if (item.events) {
    html += `<h4>Events</h4>${rowsToTable(['Event', 'Detail', 'When'], item.events)}`;
  }
  html += `<h4>File</h4><code class="path">${item.path}</code>`;
  modalContent.innerHTML = html;
  wrapCodeBlocksWithCopyButtons(modalContent);

  lastFocusedBeforeModal = document.activeElement;
  modalOverlay.hidden = false;
  modalClose.focus();
  document.addEventListener('keydown', handleModalKeydown);
}

function closeCatalogModal() {
  modalOverlay.hidden = true;
  document.removeEventListener('keydown', handleModalKeydown);
  if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
    lastFocusedBeforeModal.focus();
  }
}

function handleModalKeydown(event) {
  if (event.key === 'Escape') closeCatalogModal();
}

grid.addEventListener('click', (event) => {
  const card = event.target.closest('.catalog-card');
  if (card) openCatalogModal(card.dataset.id);
});
modalClose.addEventListener('click', closeCatalogModal);
modalOverlay.addEventListener('click', (event) => {
  if (event.target === modalOverlay) closeCatalogModal();
});

/* =========================================================================
   5. TOAST HELPER (mirrors c/toastService for the live demo)
   ========================================================================= */
const toastStack = document.getElementById('toastStack');
function showToast(message, variant) {
  const toast = document.createElement('div');
  toast.className = `toast ${variant || 'info'}`;
  toast.textContent = message;
  toastStack.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/* =========================================================================
   6. MOCK CONFIRM DIALOG (mirrors c/confirmDialog for the live demo)
   ========================================================================= */
function mockConfirm({ label, message, confirmLabel, destructive }) {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.innerHTML =
      `<h3 id="modalTitle">${escapeHtml(label)}</h3>` +
      `<p class="modal-tagline">${escapeHtml(message)}</p>` +
      `<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">` +
      `<button type="button" class="btn secondary" data-action="cancel">Cancel</button>` +
      `<button type="button" class="btn ${destructive ? '' : 'primary'}" data-action="confirm" ${destructive ? 'style="background:var(--danger);color:#fff;border-color:transparent;"' : ''}>${escapeHtml(confirmLabel || 'Confirm')}</button>` +
      `</div>`;
    modalContent.innerHTML = '';
    modalContent.appendChild(box);
    lastFocusedBeforeModal = document.activeElement;
    modalOverlay.hidden = false;

    function cleanup(result) {
      modalOverlay.hidden = true;
      box.removeEventListener('click', onClick);
      if (lastFocusedBeforeModal) lastFocusedBeforeModal.focus();
      resolve(result);
    }
    function onClick(event) {
      const action = event.target.dataset.action;
      if (action === 'confirm') cleanup(true);
      if (action === 'cancel') cleanup(false);
    }
    box.addEventListener('click', onClick);
  });
}

/* =========================================================================
   7. TRY IT - a client-side mock of c-enterprise-datatable and its newest features.
   `serverRows` is what "Salesforce" holds; `rows` is what this table has loaded. A colleague's
   change only touches serverRows, which is why conflict detection and live refresh have
   something to do.
   ========================================================================= */
(function playground() {
  const RAW_ROWS = [
    { id: '1', name: 'Acme Corporation', industry: 'Manufacturing', revenue: 4200000, owner: 'J. Reyes' },
    { id: '2', name: 'Globex Industries', industry: 'Manufacturing', revenue: 1850000, owner: 'A. Chen' },
    { id: '3', name: 'Initech Software', industry: 'Technology', revenue: 980000, owner: 'M. Patel' },
    { id: '4', name: 'Umbrella Health', industry: 'Healthcare', revenue: 6750000, owner: 'J. Reyes' },
    { id: '5', name: 'Stark Energy', industry: 'Energy', revenue: 12500000, owner: 'A. Chen' },
    { id: '6', name: 'Wayne Logistics', industry: 'Transportation', revenue: 3100000, owner: 'M. Patel' },
    { id: '7', name: 'Hooli Cloud', industry: 'Technology', revenue: 2200000, owner: 'J. Reyes' },
    { id: '8', name: 'Soylent Foods', industry: 'Consumer Goods', revenue: 890000, owner: 'A. Chen' },
    { id: '9', name: 'Massive Dynamic', industry: 'Technology', revenue: 15300000, owner: 'M. Patel' },
    { id: '10', name: 'Cyberdyne Systems', industry: 'Technology', revenue: 5400000, owner: 'J. Reyes' },
    { id: '11', name: 'Aperture Labs', industry: 'Research', revenue: 720000, owner: 'A. Chen' },
    { id: '12', name: 'Oscorp Chemicals', industry: 'Manufacturing', revenue: 3950000, owner: 'M. Patel' },
    { id: '13', name: 'Tyrell BioTech', industry: 'Healthcare', revenue: 8100000, owner: 'J. Reyes' }
  ];
  // version stands in for SystemModstamp; sfid is a made-up 15-character Salesforce Id.
  const SEED_ROWS = RAW_ROWS.map((row, index) => ({
    ...row,
    sfid: '001xx000003DE' + String(index + 1).padStart(2, '0'),
    version: 1
  }));
  const INDUSTRIES = ['Manufacturing', 'Technology', 'Healthcare', 'Energy', 'Research', 'Transportation', 'Consumer Goods'];
  const ALWAYS_FAILS_ID = '2'; // "Globex Industries" - simulates a server-side validation failure
  const PAGE_SIZE = 5;
  const COLUMNS = [
    { field: 'name', label: 'Account Name', editable: true },
    { field: 'industry', label: 'Industry', editable: true },
    { field: 'revenue', label: 'Annual Revenue', editable: false, format: 'currency' },
    { field: 'owner', label: 'Owner', editable: false }
  ];
  const FIELDS = COLUMNS.map((column) => column.field);
  const CONFLICT_MESSAGE =
    'This record was changed by someone else after you loaded it. Refresh to see the latest version, then re-apply your edit.';
  const VIEWS_KEY = 'toolkitDemoViews';

  const clone = (list) => list.map((row) => ({ ...row }));

  let serverRows = clone(SEED_ROWS);
  let rows = clone(serverRows);
  let sortField = 'name';
  let sortDir = 'asc';
  let searchTerm = '';
  let page = 1;
  let selected = new Set();
  let rowErrors = {}; // id -> message
  let hidden = new Set(); // hidden column fields
  let pendingChange = false;
  let editing = false;
  let flashIds = new Set();
  let views = [];
  let activeViewName = '';
  let showSaveForm = false;
  let searchDebounce;

  const headRow = document.getElementById('demoHeadRow');
  const body = document.getElementById('demoBody');
  const bulkBar = document.getElementById('demoBulkBar');
  const pageStatus = document.getElementById('demoPageStatus');
  const prevBtn = document.getElementById('demoPrev');
  const nextBtn = document.getElementById('demoNext');
  const searchBox = document.getElementById('demoSearch');
  const refreshBtn = document.getElementById('demoRefresh');
  const kpis = document.getElementById('demoKpis');
  const columnsBtn = document.getElementById('demoColumnsBtn');
  const columnPanel = document.getElementById('demoColumnPanel');
  const viewsBox = document.getElementById('demoViews');
  const notice = document.getElementById('demoNotice');
  const simulateBtn = document.getElementById('demoSimulate');
  const resetBtn = document.getElementById('demoReset');
  const conflictSwitch = document.getElementById('swConflict');
  const liveSwitch = document.getElementById('swLive');
  const stepsList = document.getElementById('trySteps');
  const stepsProgress = document.getElementById('tryProgress');

  /* ---- the "try this" checklist ---- */
  const stepsDone = new Set();
  function markStep(key) {
    if (stepsDone.has(key)) return;
    const item = stepsList.querySelector(`[data-step="${key}"]`);
    if (!item) return;
    stepsDone.add(key);
    item.classList.add('done');
    item.insertAdjacentHTML('beforeend', '<span class="sr-only"> (done)</span>');
    const total = stepsList.children.length;
    stepsProgress.textContent = `${stepsDone.size} of ${total}`;
    if (stepsDone.size === total) showToast('You have tried everything. Nice!', 'success');
  }

  function currencyFormat(value) {
    return '$' + Number(value).toLocaleString('en-US');
  }

  /* ---- saved views (kept in localStorage, so they survive a reload) ---- */
  function loadViews() {
    try {
      const parsed = JSON.parse(localStorage.getItem(VIEWS_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((view) => view && typeof view.name === 'string' && view.config) : [];
    } catch (error) {
      return [];
    }
  }

  function persistViews() {
    try {
      localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
    } catch (error) {
      // Storage can be blocked (private windows); views then last until the page closes.
    }
  }

  function currentConfig() {
    return { hidden: FIELDS.filter((field) => hidden.has(field)), sortField, sortDir, search: searchTerm };
  }

  function applyConfig(config) {
    const saved = config || {};
    const toHide = FIELDS.filter((field) => (saved.hidden || []).includes(field));
    hidden = new Set(toHide.length < FIELDS.length ? toHide : []); // at least one column stays
    sortField = FIELDS.includes(saved.sortField) ? saved.sortField : 'name';
    sortDir = saved.sortDir === 'desc' ? 'desc' : 'asc';
    searchTerm = typeof saved.search === 'string' ? saved.search : '';
    searchBox.value = searchTerm;
    page = 1;
    syncColumnPanel();
  }

  /* ---- what is on screen ---- */
  function visibleColumns() {
    return COLUMNS.filter((column) => !hidden.has(column.field));
  }

  function getFiltered() {
    const term = searchTerm.toLowerCase();
    const list = rows.filter((row) => !term || row.name.toLowerCase().includes(term) || row.industry.toLowerCase().includes(term));
    list.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }

  // What c-aggregate-kpi-card does server-side through GenericAggregateService: COUNT / SUM / AVG over the filtered rows.
  function renderKpis(list) {
    const total = list.reduce((sum, row) => sum + row.revenue, 0);
    const tiles = [
      ['Accounts', String(list.length)],
      ['Total revenue', currencyFormat(total)],
      ['Average revenue', list.length ? currencyFormat(Math.round(total / list.length)) : '—']
    ];
    kpis.innerHTML = tiles
      .map(([label, value]) => `<div class="demo-kpi"><span class="demo-kpi-label">${label}</span><strong>${value}</strong></div>`)
      .join('');
  }

  function renderHead(columns) {
    headRow.innerHTML =
      '<th style="width:34px"></th>' +
      columns
        .map((col) => {
          const arrow = sortField === col.field ? `<span class="sort-arrow">${sortDir === 'asc' ? '▲' : '▼'}</span>` : '';
          return `<th data-field="${col.field}">${col.label}${arrow}</th>`;
        })
        .join('');
  }

  function renderNotice() {
    if (!pendingChange) {
      notice.hidden = true;
      notice.innerHTML = '';
      return;
    }
    const unsaved = editing || Object.keys(rowErrors).length > 0;
    notice.hidden = false;
    notice.innerHTML =
      `<span>${unsaved ? 'Records have changed. Refreshing will discard your unsaved edits.' : 'Records have changed since this list was loaded.'}</span>` +
      `<button type="button" class="btn primary small" id="demoNoticeRefresh">Refresh</button>`;
    document.getElementById('demoNoticeRefresh').addEventListener('click', () => reload('Refreshed - you are looking at the latest data.'));
  }

  function renderViews() {
    // Re-rendering replaces the controls, so keep what the user was typing and where focus was.
    const typedName = viewsBox.querySelector('#demoViewName');
    const typedDefault = viewsBox.querySelector('#demoViewDefault');
    const draft = typedName ? { name: typedName.value, makeDefault: typedDefault.checked } : null;
    const focused = document.activeElement && viewsBox.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused ? focused.id || focused.dataset.viewAction : null;

    const active = views.find((view) => view.name === activeViewName);
    const modified = !!active && JSON.stringify(active.config) !== JSON.stringify(currentConfig());
    const options = ['<option value="">All records</option>']
      .concat(
        views.map(
          (view, index) =>
            `<option value="${index}"${view.name === activeViewName ? ' selected' : ''}>${escapeHtml(view.name)}${view.isDefault ? ' (default)' : ''}</option>`
        )
      )
      .join('');

    viewsBox.innerHTML =
      `<label class="views-label"><span>View</span><select id="demoViewSelect">${options}</select></label>` +
      (modified
        ? `<span class="badge-soft">Unsaved changes</span><button type="button" class="btn secondary small" data-view-action="update">Update view</button>`
        : '') +
      `<button type="button" class="btn secondary small" data-view-action="new">Save as new view</button>` +
      (active
        ? `<button type="button" class="link-btn" data-view-action="default">${active.isDefault ? 'Remove default' : 'Make default'}</button>` +
          `<button type="button" class="link-btn" data-view-action="delete">Delete view</button>`
        : '') +
      (showSaveForm
        ? `<form class="view-form" id="demoViewForm">` +
          `<input type="text" id="demoViewName" maxlength="40" placeholder="Name this view" aria-label="View name" required />` +
          `<label class="switch inline"><input type="checkbox" id="demoViewDefault" /><span>Open by default</span></label>` +
          `<button type="submit" class="btn primary small">Save view</button>` +
          `<button type="button" class="link-btn" data-view-action="cancel">Cancel</button>` +
          `</form>`
        : '');

    if (draft) {
      viewsBox.querySelector('#demoViewName').value = draft.name;
      viewsBox.querySelector('#demoViewDefault').checked = draft.makeDefault;
    }
    if (focusKey) {
      const again = viewsBox.querySelector(`[id="${focusKey}"], [data-view-action="${focusKey}"]`);
      if (again) again.focus();
    }
  }

  function render() {
    const columns = visibleColumns();
    renderHead(columns);
    const filtered = getFiltered();
    renderKpis(filtered);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    body.innerHTML = pageRows
      .map((row) => {
        const isSelected = selected.has(row.id);
        const error = rowErrors[row.id];
        const cells = columns
          .map((col) => {
            const raw = row[col.field];
            const display = col.format === 'currency' ? currencyFormat(raw) : escapeHtml(String(raw));
            return `<td class="${col.editable ? 'editable-cell' : ''}" data-id="${row.id}" data-field="${col.field}" ${col.editable ? 'data-editable="true"' : ''}>${display}</td>`;
          })
          .join('');
        const errorRow = error
          ? `<tr class="row-error"><td></td><td colspan="${columns.length}"><span class="row-error-msg">⚠ Save failed: ${escapeHtml(error)}</span></td></tr>`
          : '';
        return (
          `<tr class="${isSelected ? 'row-selected' : ''}${flashIds.has(row.id) ? ' row-flash' : ''}" data-row-id="${row.id}">` +
          `<td><input type="checkbox" data-select="${row.id}" ${isSelected ? 'checked' : ''} aria-label="Select ${escapeHtml(row.name)}" /></td>` +
          cells +
          `</tr>${errorRow}`
        );
      })
      .join('');

    pageStatus.textContent = `Page ${page} of ${totalPages} • ${filtered.length} record${filtered.length === 1 ? '' : 's'}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;

    if (selected.size > 0) {
      bulkBar.hidden = false;
      bulkBar.innerHTML =
        `<span>${selected.size} selected</span>` +
        `<div class="bulk-actions">` +
        `<button type="button" class="btn secondary small" id="demoClearSelection">Clear</button>` +
        `<button type="button" class="btn secondary small" id="demoCopyIds">Copy Ids</button>` +
        `<button type="button" class="btn small" id="demoBulkDelete" style="background:var(--danger);color:#fff;border-color:transparent;">Delete selected</button>` +
        `</div>`;
      document.getElementById('demoClearSelection').addEventListener('click', () => {
        selected.clear();
        render();
      });
      document.getElementById('demoCopyIds').addEventListener('click', handleCopyIds);
      document.getElementById('demoBulkDelete').addEventListener('click', handleBulkDelete);
    } else {
      bulkBar.hidden = true;
      bulkBar.innerHTML = '';
    }

    renderNotice();
    renderViews();
  }

  /* ---- column chooser ---- */
  function buildColumnPanel() {
    columnPanel.innerHTML =
      '<span class="panel-title">Show columns</span>' +
      COLUMNS.map(
        (col) => `<label class="switch inline"><input type="checkbox" data-col="${col.field}" checked /><span>${col.label}</span></label>`
      ).join('') +
      '<button type="button" class="link-btn" data-col-action="all">Show all</button>';
  }

  function syncColumnPanel() {
    columnPanel.querySelectorAll('[data-col]').forEach((box) => {
      box.checked = !hidden.has(box.dataset.col);
    });
  }

  columnsBtn.addEventListener('click', () => {
    const open = columnPanel.hidden;
    columnPanel.hidden = !open;
    columnsBtn.setAttribute('aria-expanded', String(open));
  });

  columnPanel.addEventListener('change', (event) => {
    const box = event.target.closest('[data-col]');
    if (!box) return;
    const wouldHideEverything = !box.checked && FIELDS.every((field) => hidden.has(field) || field === box.dataset.col);
    if (wouldHideEverything) {
      box.checked = true; // a table with no columns is useless: put the box back
      showToast('At least one column has to stay visible.', 'info');
      return;
    }
    if (box.checked) hidden.delete(box.dataset.col);
    else hidden.add(box.dataset.col);
    render();
  });

  columnPanel.addEventListener('click', (event) => {
    if (!event.target.closest('[data-col-action="all"]')) return;
    hidden.clear();
    syncColumnPanel();
    render();
  });

  /* ---- views toolbar ---- */
  function applyView(view) {
    activeViewName = view ? view.name : '';
    applyConfig(view ? view.config : null);
    render();
  }

  viewsBox.addEventListener('change', (event) => {
    if (event.target.id !== 'demoViewSelect') return;
    applyView(event.target.value === '' ? null : views[Number(event.target.value)]);
  });

  viewsBox.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-view-action]');
    if (!button) return;
    const action = button.dataset.viewAction;
    const active = views.find((view) => view.name === activeViewName);

    if (action === 'new') {
      showSaveForm = true;
      renderViews();
      const input = viewsBox.querySelector('#demoViewName');
      if (input) input.focus();
    } else if (action === 'cancel') {
      showSaveForm = false;
      renderViews();
    } else if (action === 'update' && active) {
      active.config = currentConfig();
      persistViews();
      showToast('View updated.', 'success');
      renderViews();
    } else if (action === 'default' && active) {
      const makeDefault = !active.isDefault;
      views.forEach((view) => {
        view.isDefault = false;
      });
      active.isDefault = makeDefault;
      persistViews();
      showToast(makeDefault ? `"${active.name}" will open by default.` : 'Default view removed.', 'success');
      renderViews();
    } else if (action === 'delete' && active) {
      const confirmed = await mockConfirm({
        label: 'Delete view',
        message: `Delete the view "${active.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true
      });
      if (!confirmed) return;
      views = views.filter((view) => view !== active);
      activeViewName = '';
      persistViews();
      showToast('View deleted.', 'success');
      renderViews();
    }
  });

  viewsBox.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = viewsBox.querySelector('#demoViewName').value.trim();
    const makeDefault = viewsBox.querySelector('#demoViewDefault').checked;
    if (!name) return;
    const existing = views.find((view) => view.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      const confirmed = await mockConfirm({
        label: 'Replace view',
        message: `You already have a view named "${existing.name}". Replace its settings with the table's current ones?`,
        confirmLabel: 'Replace'
      });
      if (!confirmed) return;
    }
    const view = existing || { name, isDefault: false, config: null };
    view.config = currentConfig();
    if (makeDefault) {
      views.forEach((other) => {
        other.isDefault = false;
      });
      view.isDefault = true;
    }
    if (!existing) views.push(view);
    activeViewName = view.name;
    showSaveForm = false;
    persistViews();
    showToast('View saved.', 'success');
    markStep('view');
    renderViews();
  });

  /* ---- loading, refreshing and "someone else" ---- */
  function reload(message) {
    rows = clone(serverRows);
    rowErrors = {};
    selected.clear();
    pendingChange = false;
    editing = false;
    if (message) showToast(message, 'info');
    render();
  }

  // Mirrors the datatable's auto-refresh: reload quietly only when nothing is being edited or selected.
  function reactToLiveChange() {
    const hasUnsavedEdits = editing || Object.keys(rowErrors).length > 0;
    markStep('live');
    if (selected.size === 0 && !hasUnsavedEdits) {
      const before = new Map(rows.map((row) => [row.id, row.version]));
      rows = clone(serverRows);
      flashIds = new Set(rows.filter((row) => before.get(row.id) !== row.version).map((row) => row.id));
      pendingChange = false;
      render();
      showToast('The table updated itself: a record changed elsewhere.', 'info');
      setTimeout(() => {
        flashIds.clear();
        body.querySelectorAll('.row-flash').forEach((rowEl) => rowEl.classList.remove('row-flash'));
      }, 1600);
    } else {
      pendingChange = true;
      renderNotice();
    }
  }

  function simulateColleague() {
    const target = getFiltered()
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .find((row) => row.id !== ALWAYS_FAILS_ID && serverRows.some((server) => server.id === row.id));
    if (!target) {
      showToast('There is no record on this page to change.', 'info');
      return;
    }
    const server = serverRows.find((row) => row.id === target.id);
    const choices = INDUSTRIES.filter((industry) => industry !== server.industry);
    server.industry = choices[server.version % choices.length];
    server.version += 1;
    const stale = liveSwitch.checked ? '' : ' Your table still shows the old value.';
    showToast(`A colleague changed ${server.name}: Industry is now "${server.industry}".${stale}`, 'info');
    if (liveSwitch.checked) reactToLiveChange();
  }

  function resetDemo() {
    serverRows = clone(SEED_ROWS);
    rows = clone(serverRows);
    rowErrors = {};
    selected.clear();
    pendingChange = false;
    editing = false;
    showSaveForm = false;
    activeViewName = '';
    applyConfig(null);
    conflictSwitch.checked = true;
    liveSwitch.checked = false;
    showToast('Demo reset.', 'info');
    render();
  }

  /* ---- saving an edit, deleting, copying ---- */
  function commitEdit(id, field, value, originalValue) {
    const row = rows.find((candidate) => candidate.id === id);
    const server = serverRows.find((candidate) => candidate.id === id);
    if (!row) return;
    row[field] = value; // the draft stays on screen, as in the datatable
    markStep('edit');

    if (id === ALWAYS_FAILS_ID) {
      rowErrors[id] = 'Duplicate account name detected.';
      showToast('1 saved, 1 failed. See the row for details.', 'error');
    } else if (!server) {
      rowErrors[id] = 'This record no longer exists.';
      showToast('0 saved, 1 failed.', 'error');
    } else if (conflictSwitch.checked && server.version !== row.version) {
      rowErrors[id] = CONFLICT_MESSAGE;
      showToast('0 saved, 1 failed. 1 changed by someone else - refresh to see the latest.', 'error');
      markStep('conflict');
    } else {
      const replacedSomeone = server.version !== row.version && server[field] !== originalValue;
      const replaced = server[field];
      server[field] = value;
      server.version += 1;
      row.version = server.version;
      delete rowErrors[id];
      if (replacedSomeone) {
        showToast(`Saved - and it replaced a colleague's newer value ("${replaced}"). Turn on Conflict detection to stop that.`, 'info');
      } else {
        showToast('Record saved.', 'success');
      }
    }
    render();
  }

  async function handleBulkDelete() {
    const count = selected.size;
    const confirmed = await mockConfirm({
      label: 'Delete Records',
      message: `This will permanently delete ${count} record${count === 1 ? '' : 's'}. This cannot be undone. (This is a mock - GenericDmlService.deleteRecords does the real thing. Use Reset demo to get them back.)`,
      confirmLabel: 'Delete',
      destructive: true
    });
    if (!confirmed) return;
    rows = rows.filter((row) => !selected.has(row.id));
    serverRows = serverRows.filter((row) => !selected.has(row.id));
    showToast(`${count} record${count === 1 ? '' : 's'} deleted.`, 'success');
    selected.clear();
    render();
  }

  async function handleCopyIds() {
    const ids = rows.filter((row) => selected.has(row.id)).map((row) => row.sfid);
    const copied = await copyToClipboard(ids.join('\n'));
    if (copied) {
      showToast(`${ids.length} Id${ids.length === 1 ? '' : 's'} copied. Paste them anywhere.`, 'success');
      markStep('copy');
    } else {
      showToast('Could not copy. Select the text and press Ctrl+C.', 'error');
    }
  }

  /* ---- events ---- */
  headRow.addEventListener('click', (event) => {
    const th = event.target.closest('th[data-field]');
    if (!th) return;
    const field = th.dataset.field;
    if (sortField === field) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDir = 'asc';
    }
    markStep('explore');
    render();
  });

  body.addEventListener('change', (event) => {
    if (event.target.matches('[data-select]')) {
      const id = event.target.dataset.select;
      if (event.target.checked) selected.add(id);
      else selected.delete(id);
      render();
    }
  });

  body.addEventListener('dblclick', (event) => {
    const cell = event.target.closest('td[data-editable="true"]');
    if (!cell || cell.querySelector('input')) return;
    const id = cell.dataset.id;
    const field = cell.dataset.field;
    const row = rows.find((candidate) => candidate.id === id);
    const originalValue = row[field];
    cell.innerHTML = `<input type="text" value="${escapeHtml(String(originalValue)).replace(/"/g, '&quot;')}" />`;
    const input = cell.querySelector('input');
    input.focus();
    input.select();
    editing = true;

    let finished = false;
    function finish(commit) {
      if (finished) return; // Enter and the blur it causes must not save twice
      finished = true;
      editing = false;
      const newValue = input.value;
      if (commit && newValue !== String(originalValue)) {
        commitEdit(id, field, newValue, originalValue);
      } else {
        render();
      }
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
  });

  prevBtn.addEventListener('click', () => {
    page -= 1;
    render();
  });
  nextBtn.addEventListener('click', () => {
    page += 1;
    render();
  });
  searchBox.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchTerm = searchBox.value;
      page = 1;
      markStep('explore');
      render();
    }, 250);
  });
  refreshBtn.addEventListener('click', () => reload('Refreshed - you are looking at the latest data.'));
  simulateBtn.addEventListener('click', simulateColleague);
  resetBtn.addEventListener('click', resetDemo);

  /* ---- start ---- */
  buildColumnPanel();
  views = loadViews();
  const defaultView = views.find((view) => view.isDefault);
  if (defaultView) {
    activeViewName = defaultView.name;
    applyConfig(defaultView.config);
  }
  render();
})();

/* =========================================================================
   8. FIX UP DEEP-LINK SCROLL POSITION
   Content above the target (the catalog grid, the demo table) is populated
   by the scripts above, after the browser already resolved any #hash in the
   URL against the pre-render (near-empty) layout. Re-scroll once everything
   has its final height.
   ========================================================================= */
if (window.location.hash) {
  const target = document.querySelector(window.location.hash);
  if (target) {
    requestAnimationFrame(() => target.scrollIntoView());
  }
}

/* =========================================================================
   8. WHAT'S NEW - banner, feature cards and release timeline, driven by releases.js
   ========================================================================= */
(function whatsNew() {
  const releases = window.TOOLKIT_RELEASES;
  const timer = window.ReleaseTimer;
  const banner = document.getElementById('whatsNewBanner');
  if (!releases || !timer || !banner) return;

  const { current, history, upcoming } = releases;
  const DISMISS_KEY = 'whatsNewDismissed';

  // ?previewNow=+3d shows the page as it will look in three days. The clock keeps ticking from there.
  const clock = timer.resolveNow(window.location.search, Date.now());
  const skew = clock.now - Date.now();
  const now = () => Date.now() + skew;

  function readDismissed() {
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch (error) {
      return null;
    }
  }

  function writeDismissed(version) {
    try {
      localStorage.setItem(DISMISS_KEY, version);
    } catch (error) {
      // Storage can be blocked (private windows); the banner just comes back next visit.
    }
  }

  /* ---- the banner ---- */
  document.getElementById('wnTitle').textContent = `v${current.version} is out: ${current.headline}`;
  document.getElementById('wnChips').innerHTML = current.highlights
    .map((highlight) => `<li>${escapeHtml(highlight.title)}</li>`)
    .join('');
  const dismissedVersion = readDismissed();
  banner.hidden = !clock.isPreview && dismissedVersion === current.version;
  document.getElementById('wnClose').addEventListener('click', () => {
    banner.hidden = true;
    if (!clock.isPreview) writeDismissed(current.version);
  });

  /* ---- the "what's new" section ---- */
  document.getElementById('wnSectionTitle').textContent = `What's new in v${current.version}`;
  document.getElementById('wnSectionLead').innerHTML =
    `${escapeHtml(current.summary)} Released ${escapeHtml(timer.formatDate(current.releasedAt))}. ` +
    `<a href="${escapeHtml(current.notesUrl)}">Read the changelog</a>.`;

  document.getElementById('wnFeatures').innerHTML = current.highlights
    .map((highlight) => {
      const since = highlight.releasedAt || current.releasedAt;
      const links = highlight.catalogIds
        .map((id) => {
          const entry = CATALOG.find((item) => item.id === id);
          return entry ? `<button type="button" class="wn-link" data-open-catalog="${escapeHtml(id)}">${escapeHtml(entry.name)}</button>` : '';
        })
        .join('');
      return (
        `<article class="card wn-card">` +
        `<span class="wn-live" data-since="${escapeHtml(since)}" data-format="live"></span>` +
        `<h3>${escapeHtml(highlight.title)}</h3>` +
        `<p>${escapeHtml(highlight.summary)}</p>` +
        `<div class="wn-links">${links}</div>` +
        `</article>`
      );
    })
    .join('');
  document.getElementById('wnFeatures').addEventListener('click', (event) => {
    const link = event.target.closest('[data-open-catalog]');
    if (link) openCatalogModal(link.dataset.openCatalog);
  });

  /* ---- the timeline: next release, this release, earlier releases ---- */
  const items = [];
  if (upcoming) {
    const planned = upcoming.items
      .map((item) => `<li><strong>${escapeHtml(item.title)}</strong> &mdash; ${escapeHtml(item.summary)}</li>`)
      .join('');
    items.push(
      `<li class="tl-item tl-upcoming">` +
        `<div class="tl-head"><span class="tl-version">v${escapeHtml(upcoming.version)}</span><span class="tl-tag">Up next</span></div>` +
        `<p class="tl-meta">Target ${escapeHtml(timer.formatDate(upcoming.targetAt))} &middot; <span class="wn-clock" role="timer" data-target="${escapeHtml(upcoming.targetAt)}"></span></p>` +
        `<div class="tl-bar" role="img" aria-label="Progress towards v${escapeHtml(upcoming.version)}"><span data-progress-from="${escapeHtml(current.releasedAt)}" data-progress-to="${escapeHtml(upcoming.targetAt)}"></span></div>` +
        `<p class="tl-progress" data-progress-label data-version="${escapeHtml(upcoming.version)}"></p>` +
        `<p class="tl-headline">${escapeHtml(upcoming.headline)} <em>(plans, subject to change)</em></p>` +
        `<ul class="tl-list">${planned}</ul>` +
        `</li>`
    );
  }
  items.push(
    `<li class="tl-item tl-current">` +
      `<div class="tl-head"><span class="tl-version">v${escapeHtml(current.version)}</span><span class="tl-tag tl-tag-current">Current</span></div>` +
      `<p class="tl-meta">Released ${escapeHtml(timer.formatDate(current.releasedAt))} &middot; <span data-since="${escapeHtml(current.releasedAt)}" data-format="live"></span></p>` +
      `<p class="tl-headline">${escapeHtml(current.headline)}</p>` +
      `</li>`
  );
  history.forEach((entry) => {
    items.push(
      `<li class="tl-item">` +
        `<div class="tl-head"><span class="tl-version">v${escapeHtml(entry.version)}</span></div>` +
        `<p class="tl-meta">Released ${escapeHtml(timer.formatDate(entry.releasedAt))} &middot; <span data-since="${escapeHtml(entry.releasedAt)}" data-format="ago"></span></p>` +
        `<p class="tl-headline">${escapeHtml(entry.headline)}</p>` +
        `</li>`
    );
  });
  document.getElementById('releaseTimeline').innerHTML = items.join('');

  document.getElementById('wnFootnote').innerHTML = clock.isPreview
    ? `Previewing the site as it will look on <strong>${escapeHtml(timer.formatDate(clock.now))}</strong>. Remove <code>?previewNow</code> from the address to return to today.`
    : `Dates are UTC and the timers update live. To see how this page will look later, add <code>?previewNow=+3d</code> to the address.`;

  /* ---- one ticker keeps every timer current ---- */
  const nextBox = document.getElementById('wnNext');
  const nextLabel = document.getElementById('wnNextLabel');
  const nextClock = document.getElementById('wnNextClock');
  const wnAge = document.getElementById('wnAge');

  function tick() {
    const at = now();
    wnAge.textContent = `· ${timer.liveFor(current.releasedAt, at)}`;

    document.querySelectorAll('[data-since]').forEach((el) => {
      el.textContent =
        el.dataset.format === 'ago' ? timer.releasedAgo(el.dataset.since, at) : timer.liveFor(el.dataset.since, at);
    });

    document.querySelectorAll('[data-target]').forEach((el) => {
      const target = timer.describeTarget(el.dataset.target, at);
      el.textContent = !target ? '' : target.phase === 'scheduled' ? `Releases in ${target.text}` : target.phase === 'due' ? 'Due now' : `Target passed - ${target.text}`;
      el.dataset.phase = target ? target.phase : '';
    });

    document.querySelectorAll('[data-progress-from]').forEach((bar) => {
      const share = timer.progress(bar.dataset.progressFrom, bar.dataset.progressTo, at);
      bar.style.width = `${(share * 100).toFixed(1)}%`;
      const label = document.querySelector('[data-progress-label]');
      if (label) label.textContent = `${Math.round(share * 100)}% of the way from v${current.version} to v${label.dataset.version}`;
    });

    if (upcoming) {
      const target = timer.describeTarget(upcoming.targetAt, at);
      nextBox.hidden = !target;
      if (target) {
        nextLabel.textContent = `Next: v${upcoming.version}`;
        nextClock.textContent = target.phase === 'scheduled' ? `in ${target.text}` : target.phase === 'due' ? 'due now' : target.text;
      }
    }
  }

  tick();
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
})();
