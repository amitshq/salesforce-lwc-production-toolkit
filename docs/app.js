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
      const text = pre.textContent;
      navigator.clipboard
        .writeText(text)
        .then(() => {
          button.textContent = 'Copied!';
          button.classList.add('copied');
          setTimeout(() => {
            button.textContent = 'Copy';
            button.classList.remove('copied');
          }, 1500);
        })
        .catch(() => {
          button.textContent = 'Press Ctrl+C';
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

/* ---- render the catalog grid ---- */
const grid = document.getElementById('catalogGrid');
const emptyMsg = document.getElementById('catalogEmpty');
const searchInput = document.getElementById('catalogSearch');
const pills = document.querySelectorAll('#filterPills .pill');
let activeFilter = 'all';

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

function renderCatalog() {
  const term = (searchInput.value || '').toLowerCase().trim();
  const filtered = CATALOG.filter((item) => {
    const matchesFilter = activeFilter === 'all' || item.category === activeFilter;
    const haystack = `${item.name} ${item.tagline} ${item.category} ${item.path}`.toLowerCase();
    const matchesSearch = !term || haystack.includes(term);
    return matchesFilter && matchesSearch;
  });
  grid.innerHTML = filtered.map(cardHtml).join('');
  emptyMsg.hidden = filtered.length !== 0;
}

pills.forEach((pill) => {
  pill.addEventListener('click', () => {
    pills.forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    activeFilter = pill.dataset.filter;
    renderCatalog();
  });
});
searchInput.addEventListener('input', renderCatalog);
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
  html += `<h4>Usage</h4><div class="code-block"><pre><code>${escapeHtml(item.usage)}</code></pre></div>`;
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
   7. LIVE DEMO - a fully client-side mock of the enterpriseDatatable pipeline
   ========================================================================= */
(function liveDemo() {
  const ORIGINAL_ROWS = [
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
  const ALWAYS_FAILS_ID = '2'; // "Globex Industries" - simulates a server-side validation failure
  const PAGE_SIZE = 5;
  const COLUMNS = [
    { field: 'name', label: 'Account Name', editable: true },
    { field: 'industry', label: 'Industry', editable: true },
    { field: 'revenue', label: 'Annual Revenue', editable: false, format: 'currency' },
    { field: 'owner', label: 'Owner', editable: false }
  ];

  let rows = ORIGINAL_ROWS.map((r) => ({ ...r }));
  let sortField = 'name';
  let sortDir = 'asc';
  let searchTerm = '';
  let page = 1;
  let selected = new Set();
  let rowErrors = {}; // id -> message
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

  function currencyFormat(value) {
    return '$' + Number(value).toLocaleString('en-US');
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

  function getFiltered() {
    const term = searchTerm.toLowerCase();
    let list = rows.filter(
      (r) => !term || r.name.toLowerCase().includes(term) || r.industry.toLowerCase().includes(term)
    );
    list.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      let cmp;
      if (typeof av === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }

  function renderHead() {
    headRow.innerHTML =
      '<th style="width:34px"></th>' +
      COLUMNS.map((col) => {
        const arrow = sortField === col.field ? `<span class="sort-arrow">${sortDir === 'asc' ? '▲' : '▼'}</span>` : '';
        return `<th data-field="${col.field}">${col.label}${arrow}</th>`;
      }).join('');
  }

  function render() {
    renderHead();
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
        const cells = COLUMNS.map((col) => {
          const raw = row[col.field];
          const display = col.format === 'currency' ? currencyFormat(raw) : escapeHtml(String(raw));
          const editableClass = col.editable ? 'editable-cell' : '';
          return `<td class="${editableClass}" data-id="${row.id}" data-field="${col.field}" ${col.editable ? 'data-editable="true"' : ''}>${display}</td>`;
        }).join('');
        const errorRow = error
          ? `<tr class="row-error"><td></td><td colspan="${COLUMNS.length}"><span class="row-error-msg">⚠ Save failed: ${escapeHtml(error)}</span></td></tr>`
          : '';
        return (
          `<tr class="${isSelected ? 'row-selected' : ''}" data-row-id="${row.id}">` +
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
        `<div style="display:flex;gap:8px;">` +
        `<button type="button" class="btn secondary small" id="demoClearSelection">Clear</button>` +
        `<button type="button" class="btn small" id="demoBulkDelete" style="background:var(--danger);color:#fff;border-color:transparent;">Delete selected</button>` +
        `</div>`;
      document.getElementById('demoClearSelection').addEventListener('click', () => {
        selected.clear();
        render();
      });
      document.getElementById('demoBulkDelete').addEventListener('click', handleBulkDelete);
    } else {
      bulkBar.hidden = true;
      bulkBar.innerHTML = '';
    }
  }

  async function handleBulkDelete() {
    const count = selected.size;
    const confirmed = await mockConfirm({
      label: 'Delete Records',
      message: `This will permanently delete ${count} record${count === 1 ? '' : 's'}. This cannot be undone. (This is a mock - GenericDmlService.deleteRecords does the real thing.)`,
      confirmLabel: 'Delete',
      destructive: true
    });
    if (!confirmed) return;
    rows = rows.filter((r) => !selected.has(r.id));
    showToast(`${count} record${count === 1 ? '' : 's'} deleted.`, 'success');
    selected.clear();
    render();
  }

  function commitEdit(id, field, value) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    row[field] = value;

    if (id === ALWAYS_FAILS_ID) {
      rowErrors[id] = 'Duplicate account name detected.';
      showToast('1 saved, 1 failed. See the row for details.', 'error');
    } else {
      delete rowErrors[id];
      showToast('Record saved.', 'success');
    }
    render();
  }

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
    const row = rows.find((r) => r.id === id);
    const originalValue = row[field];
    cell.innerHTML = `<input type="text" value="${escapeHtml(String(originalValue))}" />`;
    const input = cell.querySelector('input');
    input.focus();
    input.select();

    function finish(commit) {
      const newValue = input.value;
      if (commit && newValue !== String(originalValue)) {
        commitEdit(id, field, newValue);
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
      render();
    }, 250);
  });
  refreshBtn.addEventListener('click', () => {
    rows = ORIGINAL_ROWS.map((r) => ({ ...r }));
    rowErrors = {};
    selected.clear();
    searchTerm = '';
    searchBox.value = '';
    page = 1;
    showToast('Refreshed.', 'info');
    render();
  });

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
