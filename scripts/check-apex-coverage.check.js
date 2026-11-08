/* eslint-env node */
/* Run with: npm run test:site (node --test). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parsePercent, coverageFromSummary, check } = require('./check-apex-coverage.js');

function resultsDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-results-'));
  Object.entries(files).forEach(([name, content]) => fs.writeFileSync(path.join(dir, name), JSON.stringify(content)));
  return dir;
}

test('parsePercent reads "87%", "87", 87 and rejects the rest', () => {
  assert.equal(parsePercent('87%'), 87);
  assert.equal(parsePercent(' 86.5 % '), 86.5);
  assert.equal(parsePercent('87'), 87);
  assert.equal(parsePercent(87), 87);
  assert.ok(Number.isNaN(parsePercent('n/a')));
  assert.ok(Number.isNaN(parsePercent(undefined)));
});

test('coverageFromSummary prefers the run coverage and falls back to org-wide', () => {
  assert.deepEqual(coverageFromSummary({ testRunCoverage: '90%', orgWideCoverage: '80%' }), { percent: 90, source: 'testRunCoverage' });
  assert.deepEqual(coverageFromSummary({ orgWideCoverage: '80%' }), { percent: 80, source: 'orgWideCoverage' });
  assert.equal(coverageFromSummary({ outcome: 'Passed' }), null);
  assert.equal(coverageFromSummary(undefined), null);
});

test('passes at or above the minimum', () => {
  const dir = resultsDir({ 'test-result-707xx.json': { summary: { testRunCoverage: '85%' } } });
  assert.equal(check(dir, '85').ok, true);
  assert.match(check(dir, '85').message, /Apex coverage 85%/);
});

test('fails below the minimum and says by how much it missed', () => {
  const dir = resultsDir({ 'test-result-707xx.json': { summary: { testRunCoverage: '84%' } } });
  const result = check(dir, 85);
  assert.equal(result.ok, false);
  assert.match(result.message, /coverage 84%.*minimum 85%/);
});

test('ignores the separate code-coverage file and reads the run result', () => {
  const dir = resultsDir({
    'test-result-codecoverage.json': [{ name: 'GenericQueryService', coveredPercent: 10 }],
    'test-result-707xx.json': { summary: { testRunCoverage: '92%' } }
  });
  assert.equal(check(dir, 85).ok, true);
});

test('also reads a result wrapped as { result: { summary } } (--json output)', () => {
  const dir = resultsDir({ 'test-result-707xx.json': { status: 0, result: { summary: { orgWideCoverage: '88%' } } } });
  assert.equal(check(dir, 85).ok, true);
});

test('fails clearly when there is nothing to read', () => {
  assert.equal(check(path.join(os.tmpdir(), 'no-such-dir-for-apex-results'), 85).ok, false);
  assert.match(check(resultsDir({ 'test-result-707xx.json': { summary: { outcome: 'Passed' } } }), 85).message, /--code-coverage/);
  assert.match(check(resultsDir({}), 'eighty').message, /not a number/);
});
