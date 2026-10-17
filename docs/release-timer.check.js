/* Run with: npm run test:site  (node --test, no dependencies) */
const test = require('node:test');
const assert = require('node:assert/strict');
const timer = require('./release-timer.js');
const releases = require('./releases.js');

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const T0 = Date.parse('2026-10-17T12:00:00Z');

test('describeElapsed: picks a sensible unit and pluralises it', () => {
  const cases = [
    [0, 'less than a minute'],
    [59 * 1000, 'less than a minute'],
    [60 * 1000, '1 minute'],
    [59 * MINUTE, '59 minutes'],
    [HOUR, '1 hour'],
    [23 * HOUR + 59 * MINUTE, '23 hours'],
    [DAY, '1 day'],
    [2 * DAY, '2 days'],
    [45 * DAY, '45 days'],
    [59 * DAY, '59 days'],
    [60 * DAY, '2 months'],
    [400 * DAY, '13 months'],
    [729 * DAY, '24 months'],
    [730 * DAY, '2 years']
  ];
  cases.forEach(([elapsed, expected]) => {
    assert.equal(timer.describeElapsed(T0, T0 + elapsed).text, expected, `after ${elapsed} ms`);
  });
});

test('describeElapsed: a future or invalid date is handled, not thrown on', () => {
  assert.equal(timer.describeElapsed(T0 + DAY, T0).text, 'less than a minute');
  assert.equal(timer.describeElapsed('not a date', T0), null);
  assert.equal(timer.describeElapsed(T0, NaN), null);
});

test('liveFor: "Live for N days" from the release moment', () => {
  const released = '2026-10-17T12:00:00Z';
  assert.equal(timer.liveFor(released, T0), 'Just released');
  assert.equal(timer.liveFor(released, T0 + 5 * MINUTE), 'Live for 5 minutes');
  assert.equal(timer.liveFor(released, T0 + 3 * HOUR), 'Live for 3 hours');
  assert.equal(timer.liveFor(released, T0 + DAY), 'Live for 1 day');
  assert.equal(timer.liveFor(released, T0 + 2 * DAY + 5 * HOUR), 'Live for 2 days');
  assert.equal(timer.liveFor(released, T0 + 90 * DAY), 'Live for 3 months');
});

test('liveFor: switches from 23 hours to 1 day exactly at 24 hours', () => {
  assert.equal(timer.liveFor(T0, T0 + DAY - 1), 'Live for 23 hours');
  assert.equal(timer.liveFor(T0, T0 + DAY), 'Live for 1 day');
});

test('liveFor: a release dated in the future is not "live"', () => {
  assert.equal(timer.liveFor(T0 + DAY, T0), 'Not released yet');
  assert.equal(timer.liveFor('garbage', T0), '');
});

test('releasedAgo: the same span phrased as the past', () => {
  assert.equal(timer.releasedAgo(T0, T0), 'just now');
  assert.equal(timer.releasedAgo(T0, T0 + DAY), '1 day ago');
  assert.equal(timer.releasedAgo(T0, T0 + 12 * DAY), '12 days ago');
  assert.equal(timer.releasedAgo(T0 + DAY, T0), 'not released yet');
  assert.equal(timer.releasedAgo('garbage', T0), '');
});

test('accepts ISO strings, Dates and numbers alike', () => {
  const iso = '2026-10-17T12:00:00Z';
  const now = T0 + 2 * DAY;
  assert.equal(timer.liveFor(iso, now), 'Live for 2 days');
  assert.equal(timer.liveFor(new Date(iso), new Date(now)), 'Live for 2 days');
  assert.equal(timer.liveFor(T0, now), 'Live for 2 days');
});

test('countdown: splits the remaining time', () => {
  const target = T0 + (28 * DAY + 4 * HOUR + 12 * MINUTE + 5 * 1000);
  const parts = timer.countdown(target, T0);
  assert.deepEqual([parts.days, parts.hours, parts.minutes, parts.seconds], [28, 4, 12, 5]);
  assert.equal(parts.done, false);
});

test('countdown: ticks down one second at a time', () => {
  const target = T0 + 61 * 1000;
  assert.equal(timer.formatCountdown(timer.countdown(target, T0)), '01m 01s');
  assert.equal(timer.formatCountdown(timer.countdown(target, T0 + 1000)), '01m 00s');
  assert.equal(timer.formatCountdown(timer.countdown(target, T0 + 2000)), '59s');
});

test('formatCountdown: drops leading zero units and pads the rest', () => {
  assert.equal(timer.formatCountdown({ days: 28, hours: 4, minutes: 3, seconds: 9 }), '28d 04h 03m 09s');
  assert.equal(timer.formatCountdown({ days: 0, hours: 4, minutes: 3, seconds: 9 }), '04h 03m 09s');
  assert.equal(timer.formatCountdown({ days: 0, hours: 0, minutes: 3, seconds: 9 }), '03m 09s');
  assert.equal(timer.formatCountdown({ days: 0, hours: 0, minutes: 0, seconds: 9 }), '09s');
  assert.equal(timer.formatCountdown(null), '');
});

test('describeTarget: scheduled, due, then overdue', () => {
  const target = T0 + 2 * DAY;
  assert.deepEqual(
    [timer.describeTarget(target, T0).phase, timer.describeTarget(target, T0).text],
    ['scheduled', '2d 00h 00m 00s']
  );
  assert.equal(timer.describeTarget(target, target).phase, 'due');
  assert.equal(timer.describeTarget(target, target + 59 * 1000).phase, 'due');
  const overdue = timer.describeTarget(target, target + 3 * DAY);
  assert.equal(overdue.phase, 'overdue');
  assert.equal(overdue.text, 'overdue by 3 days');
  assert.equal(timer.describeTarget('garbage', T0), null);
});

test('progress: the share of the way from one date to another, clamped to 0..1', () => {
  const start = T0;
  const end = T0 + 10 * DAY;
  assert.equal(timer.progress(start, end, start - DAY), 0);
  assert.equal(timer.progress(start, end, start), 0);
  assert.equal(timer.progress(start, end, start + 5 * DAY), 0.5);
  assert.equal(timer.progress(start, end, end), 1);
  assert.equal(timer.progress(start, end, end + DAY), 1);
  assert.equal(timer.progress(end, start, start), 0, 'an end before the start has no progress');
  assert.equal(timer.progress('garbage', end, start), 0);
});

test('formatDate: always the UTC date, whatever the visitor time zone', () => {
  assert.equal(timer.formatDate('2026-10-17T00:30:00Z'), 'Oct 17, 2026');
  assert.equal(timer.formatDate('2026-10-17T23:30:00Z'), 'Oct 17, 2026');
  assert.equal(timer.formatDate('garbage'), '');
});

test('resolveNow: no preview parameter means the real time', () => {
  assert.deepEqual(timer.resolveNow('', T0), { now: T0, isPreview: false });
  assert.deepEqual(timer.resolveNow('?other=1', T0), { now: T0, isPreview: false });
  assert.deepEqual(timer.resolveNow(undefined, T0), { now: T0, isPreview: false });
});

test('resolveNow: ?previewNow= accepts offsets and absolute dates', () => {
  assert.deepEqual(timer.resolveNow('?previewNow=%2B2d', T0), { now: T0 + 2 * DAY, isPreview: true });
  assert.deepEqual(timer.resolveNow('?previewNow=+2d', T0), { now: T0 + 2 * DAY, isPreview: true });
  assert.deepEqual(timer.resolveNow('?previewNow=-3h', T0), { now: T0 - 3 * HOUR, isPreview: true });
  assert.deepEqual(timer.resolveNow('?x=1&previewNow=%2B90m&y=2', T0), { now: T0 + 90 * MINUTE, isPreview: true });
  assert.deepEqual(timer.resolveNow('?previewNow=2026-10-19T09:00:00Z', T0), {
    now: Date.parse('2026-10-19T09:00:00Z'),
    isPreview: true
  });
});

test('resolveNow: a value it cannot read is ignored', () => {
  assert.deepEqual(timer.resolveNow('?previewNow=tomorrow', T0), { now: T0, isPreview: false });
  assert.deepEqual(timer.resolveNow('?previewNow=%2B2w', T0), { now: T0, isPreview: false });
});

/* ---- the release data the banner is built from ---- */

const SEMVER = /^\d+\.\d+\.\d+$/;

function semverParts(version) {
  return version.split('.').map(Number);
}

function isNewer(a, b) {
  const [x, y] = [semverParts(a), semverParts(b)];
  for (let i = 0; i < 3; i += 1) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return false;
}

test('releases: the current release is well-formed', () => {
  const { current } = releases;
  assert.match(current.version, SEMVER);
  assert.ok(!Number.isNaN(Date.parse(current.releasedAt)), 'releasedAt must be a valid date');
  assert.ok(current.headline && current.summary);
  assert.match(current.notesUrl, /^https:\/\//);
});

test('releases: package.json carries the current version', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.version, releases.current.version, 'bump package.json (npm version) together with docs/releases.js');
});

test('releases: highlights have unique ids and the fields the cards render', () => {
  const ids = releases.current.highlights.map((h) => h.id);
  assert.ok(ids.length > 0);
  assert.equal(new Set(ids).size, ids.length, 'highlight ids must be unique');
  releases.current.highlights.forEach((h) => {
    assert.ok(h.title && h.summary, `${h.id} needs a title and summary`);
    assert.ok(Array.isArray(h.catalogIds) && h.catalogIds.length > 0, `${h.id} needs catalogIds`);
    if (h.releasedAt) assert.ok(!Number.isNaN(Date.parse(h.releasedAt)), `${h.id} releasedAt must be a valid date`);
  });
});

test('releases: history is older than the current release and newest first', () => {
  const currentAt = Date.parse(releases.current.releasedAt);
  const seen = new Set([releases.current.version]);
  let previousAt = currentAt;
  releases.history.forEach((entry) => {
    assert.match(entry.version, SEMVER);
    assert.ok(!seen.has(entry.version), `${entry.version} appears twice`);
    seen.add(entry.version);
    assert.ok(isNewer(releases.current.version, entry.version), `${entry.version} must be older than the current version`);
    const at = Date.parse(entry.releasedAt);
    assert.ok(!Number.isNaN(at), `${entry.version} releasedAt must be a valid date`);
    assert.ok(at < previousAt, `${entry.version} must be released before the entry listed above it`);
    previousAt = at;
  });
});

test('releases: the upcoming release, if any, is newer and later than the current one', () => {
  const { upcoming, current } = releases;
  if (!upcoming) return;
  assert.match(upcoming.version, SEMVER);
  assert.ok(isNewer(upcoming.version, current.version), 'upcoming.version must be higher than the current version');
  const target = Date.parse(upcoming.targetAt);
  assert.ok(!Number.isNaN(target), 'targetAt must be a valid date');
  assert.ok(target > Date.parse(current.releasedAt), 'the target date must be after the current release date');
  assert.ok(upcoming.items.length > 0);
  upcoming.items.forEach((item) => assert.ok(item.title && item.summary));
});
