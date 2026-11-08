/* Run with: npm run test:site  (node --test, no dependencies)
   Keeps the website catalog honest: every entry points at something that exists, every component and
   Apex service has an entry, and the "what's new" cards link to real catalog entries. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('./catalog.js');
const goals = require('./goals.js');
const releases = require('./releases.js');
const readmeIndex = require('../scripts/readme-index.js');

const SOURCE = path.join(__dirname, '..', 'force-app', 'main', 'default');
const CATEGORIES = ['Data components', 'UX components', 'Data utilities', 'Salesforce utilities', 'Apex services'];
// Demo wiring, not a reusable piece.
const NOT_CATALOGUED_LWC = new Set(['enterpriseDatatableDemo']);

test('every entry has what the page renders', () => {
  catalog.forEach((item) => {
    ['id', 'name', 'kind', 'path', 'tagline', 'usage'].forEach((field) => {
      assert.ok(item[field], `${item.id || '(no id)'} is missing "${field}"`);
    });
    assert.ok(CATEGORIES.includes(item.category), `${item.id} has an unknown category "${item.category}"`);
  });
});

test('ids are unique', () => {
  const ids = catalog.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
});

test('detail tables have the right number of columns in every row', () => {
  const widths = { api: 4, functions: 2, methods: 3, events: 3 };
  catalog.forEach((item) => {
    Object.entries(widths).forEach(([key, width]) => {
      (item[key] || []).forEach((row, index) => {
        assert.equal(row.length, width, `${item.id}.${key}[${index}] has ${row.length} columns, expected ${width}`);
      });
    });
  });
});

test('every path points at a real file or component folder', () => {
  catalog.forEach((item) => {
    assert.ok(fs.existsSync(path.join(SOURCE, item.path)), `${item.id}: ${item.path} does not exist`);
  });
});

test('every reusable component and module has a catalog entry', () => {
  const documented = new Set(catalog.map((item) => item.path));
  const folders = fs
    .readdirSync(path.join(SOURCE, 'lwc'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NOT_CATALOGUED_LWC.has(entry.name))
    .map((entry) => `lwc/${entry.name}`);
  const missing = folders.filter((folder) => !documented.has(folder));
  assert.deepEqual(missing, [], `add these to docs/catalog.js: ${missing.join(', ')}`);
});

test('every Apex service has a catalog entry', () => {
  const documented = new Set(catalog.map((item) => item.path));
  const services = fs
    .readdirSync(path.join(SOURCE, 'classes'))
    .filter((file) => /Service\.cls$/.test(file))
    .map((file) => `classes/${file}`);
  const missing = services.filter((service) => !documented.has(service));
  assert.deepEqual(missing, [], `add these to docs/catalog.js: ${missing.join(', ')}`);
});

test('every Apex service is granted by the LWCToolkitAdmin permission set', () => {
  const xml = fs.readFileSync(path.join(SOURCE, 'permissionsets', 'LWCToolkitAdmin.permissionset-meta.xml'), 'utf8');
  const granted = new Set([...xml.matchAll(/<apexClass>(\w+)<\/apexClass>/g)].map((match) => match[1]));
  const services = fs
    .readdirSync(path.join(SOURCE, 'classes'))
    .filter((file) => /Service\.cls$/.test(file))
    .map((file) => file.replace('.cls', ''));
  const missing = services.filter((service) => !granted.has(service));
  assert.deepEqual(missing, [], `grant these in the permission set: ${missing.join(', ')}`);
});

test('the "what\'s new" cards link to catalog entries that exist', () => {
  const ids = new Set(catalog.map((item) => item.id));
  releases.current.highlights.forEach((highlight) => {
    highlight.catalogIds.forEach((id) => {
      assert.ok(ids.has(id), `highlight "${highlight.id}" links to unknown catalog id "${id}"`);
    });
  });
});

test('every goal has what the website and README render, and unique ids', () => {
  const ids = goals.map((goal) => goal.id);
  assert.equal(new Set(ids).size, ids.length, 'goal ids must be unique');
  goals.forEach((goal) => {
    ['id', 'label', 'blurb'].forEach((field) => assert.ok(goal[field], `goal "${goal.id}" is missing "${field}"`));
    assert.ok(Array.isArray(goal.ids) && goal.ids.length > 0, `goal "${goal.id}" lists no pieces`);
  });
});

test('goals only list catalog entries that exist, and none twice in one goal', () => {
  const known = new Set(catalog.map((item) => item.id));
  goals.forEach((goal) => {
    assert.equal(new Set(goal.ids).size, goal.ids.length, `goal "${goal.id}" lists a piece twice`);
    goal.ids.forEach((id) => assert.ok(known.has(id), `goal "${goal.id}" lists unknown catalog id "${id}"`));
  });
});

test('every catalog entry belongs to at least one goal, so it can be found from the filter buttons', () => {
  const listed = new Set(goals.flatMap((goal) => goal.ids));
  const orphans = catalog.map((item) => item.id).filter((id) => !listed.has(id));
  assert.deepEqual(orphans, [], `add these to a goal in docs/goals.js: ${orphans.join(', ')}`);
});

test('the README "What\'s inside" list is up to date (run: npm run docs:readme)', () => {
  const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(readmeIndex.apply(readme), readme, 'README.md is out of date: run "npm run docs:readme" and commit it');
});

test('every LWC bundle has its configuration file, which Salesforce requires to deploy it', () => {
  const missing = fs
    .readdirSync(path.join(SOURCE, 'lwc'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !fs.existsSync(path.join(SOURCE, 'lwc', name, `${name}.js-meta.xml`)));
  assert.deepEqual(missing, [], `add a <name>.js-meta.xml to: ${missing.join(', ')}`);
});

test('every LWC configuration file declares an apiVersion', () => {
  const missing = fs
    .readdirSync(path.join(SOURCE, 'lwc'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const file = path.join(SOURCE, 'lwc', name, `${name}.js-meta.xml`);
      return fs.existsSync(file) && !/<apiVersion>\d+\.\d<\/apiVersion>/.test(fs.readFileSync(file, 'utf8'));
    });
  assert.deepEqual(missing, [], `these configuration files have no apiVersion: ${missing.join(', ')}`);
});
