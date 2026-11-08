/* eslint-env node */
/**
 * Fails the Apex CI job when test coverage is below a minimum.
 *
 *   node scripts/check-apex-coverage.js <results-dir> <minimum-percent>
 *
 * Reads the JSON result that `sf apex run test --code-coverage --output-dir <dir>` writes
 * (test-result-<runId>.json) and compares its summary coverage with the minimum.
 */
const fs = require('node:fs');
const path = require('node:path');

/** "87%" or 87 -> 87; anything else -> NaN. */
function parsePercent(value) {
  if (typeof value === 'number') return value;
  const match = /^\s*(\d+(?:\.\d+)?)\s*%?\s*$/.exec(String(value === undefined || value === null ? '' : value));
  return match ? Number(match[1]) : NaN;
}

/**
 * The coverage figure from a test-run summary: the run's own coverage when present,
 * else the org-wide figure. Returns null when neither is there.
 */
function coverageFromSummary(summary) {
  if (!summary) return null;
  for (const key of ['testRunCoverage', 'orgWideCoverage']) {
    const percent = parsePercent(summary[key]);
    if (!Number.isNaN(percent)) return { percent, source: key };
  }
  return null;
}

/** Finds the run's JSON result in the output directory and returns its coverage. */
function readCoverage(dir) {
  const candidates = fs
    .readdirSync(dir)
    .filter((name) => /^test-result-.*\.json$/.test(name) && !/codecoverage/.test(name));
  for (const name of candidates) {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    const coverage = coverageFromSummary(parsed.summary || (parsed.result && parsed.result.summary));
    if (coverage) return { ...coverage, file: name };
  }
  return null;
}

/** Returns { ok, message } for the given directory and minimum. */
function check(dir, minimum) {
  const min = parsePercent(minimum);
  if (Number.isNaN(min)) {
    return { ok: false, message: `The minimum "${minimum}" is not a number.` };
  }
  if (!fs.existsSync(dir)) {
    return { ok: false, message: `No test results in ${dir}: did the test run produce any?` };
  }
  const coverage = readCoverage(dir);
  if (!coverage) {
    return { ok: false, message: `No coverage figure found in ${dir}. Run the tests with --code-coverage.` };
  }
  const summary = `Apex coverage ${coverage.percent}% (${coverage.source} in ${coverage.file}); minimum ${min}%.`;
  return coverage.percent >= min ? { ok: true, message: summary } : { ok: false, message: `${summary} Add tests to raise it.` };
}

if (require.main === module) {
  const [dir, minimum] = process.argv.slice(2);
  const result = check(dir || 'test-results', minimum === undefined ? '85' : minimum);
  process.stdout.write(`${result.ok ? '' : '::error::'}${result.message}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

module.exports = { parsePercent, coverageFromSummary, readCoverage, check };
