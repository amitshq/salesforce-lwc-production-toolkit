/* Time maths for the "what's new" banner and release timeline. Everything takes `now` as an argument
   (milliseconds since the epoch) instead of reading the clock, so it is deterministic to test and the
   page can preview a future date. Loaded by the page (window.ReleaseTimer) and by release-timer.check.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ReleaseTimer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  /** Milliseconds since the epoch for an ISO date string or Date; NaN when it is not a valid date. */
  function toMs(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    return typeof value === 'string' ? Date.parse(value) : NaN;
  }

  function plural(count, unit) {
    return count + ' ' + unit + (count === 1 ? '' : 's');
  }

  /**
   * How long ago something happened, as a number and unit: "12 minutes", "5 hours", "1 day",
   * "45 days", "3 months", "2 years". Days are used up to 60 so a recent release reads "2 days",
   * "30 days", not "4 weeks". A date in the future counts as zero. Returns null for an invalid date.
   */
  function describeElapsed(from, now) {
    const start = toMs(from);
    if (Number.isNaN(start) || Number.isNaN(toMs(now))) return null;
    const elapsed = Math.max(0, toMs(now) - start);
    if (elapsed < MINUTE) return { ms: elapsed, text: 'less than a minute', justNow: true };
    if (elapsed < HOUR) return { ms: elapsed, text: plural(Math.floor(elapsed / MINUTE), 'minute') };
    if (elapsed < DAY) return { ms: elapsed, text: plural(Math.floor(elapsed / HOUR), 'hour') };
    const days = Math.floor(elapsed / DAY);
    if (days < 60) return { ms: elapsed, text: plural(days, 'day') };
    if (days < 730) return { ms: elapsed, text: plural(Math.floor(days / 30), 'month') };
    return { ms: elapsed, text: plural(Math.floor(days / 365), 'year') };
  }

  /** "Live for 2 days" - how long a release or feature has been out. */
  function liveFor(releasedAt, now) {
    const start = toMs(releasedAt);
    if (Number.isNaN(start) || Number.isNaN(toMs(now))) return '';
    if (start > toMs(now)) return 'Not released yet';
    const elapsed = describeElapsed(releasedAt, now);
    return elapsed.justNow ? 'Just released' : 'Live for ' + elapsed.text;
  }

  /** "2 days ago" - the same span, phrased as a point in the past. */
  function releasedAgo(releasedAt, now) {
    const start = toMs(releasedAt);
    if (Number.isNaN(start) || Number.isNaN(toMs(now))) return '';
    if (start > toMs(now)) return 'not released yet';
    const elapsed = describeElapsed(releasedAt, now);
    return elapsed.justNow ? 'just now' : elapsed.text + ' ago';
  }

  /** The time left until a target, split into days/hours/minutes/seconds. `done` once it has passed. */
  function countdown(targetAt, now) {
    const target = toMs(targetAt);
    if (Number.isNaN(target) || Number.isNaN(toMs(now))) return null;
    const diff = target - toMs(now);
    const remaining = Math.max(0, diff);
    return {
      totalMs: remaining,
      done: diff <= 0,
      overdueMs: Math.max(0, -diff),
      days: Math.floor(remaining / DAY),
      hours: Math.floor((remaining % DAY) / HOUR),
      minutes: Math.floor((remaining % HOUR) / MINUTE),
      seconds: Math.floor((remaining % MINUTE) / SECOND)
    };
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /** "28d 04h 12m 05s", dropping leading units that are zero: "04h 12m 05s", "12m 05s", "05s". */
  function formatCountdown(parts) {
    if (!parts) return '';
    if (parts.days > 0) return parts.days + 'd ' + pad(parts.hours) + 'h ' + pad(parts.minutes) + 'm ' + pad(parts.seconds) + 's';
    if (parts.hours > 0) return pad(parts.hours) + 'h ' + pad(parts.minutes) + 'm ' + pad(parts.seconds) + 's';
    if (parts.minutes > 0) return pad(parts.minutes) + 'm ' + pad(parts.seconds) + 's';
    return pad(parts.seconds) + 's';
  }

  /**
   * Where an upcoming release stands: scheduled (with a live countdown), due (the target time has
   * just arrived), or overdue (the target passed and it is still not out).
   * @returns {{phase: string, text: string, parts: object}|null}
   */
  function describeTarget(targetAt, now) {
    const parts = countdown(targetAt, now);
    if (!parts) return null;
    if (!parts.done) return { phase: 'scheduled', text: formatCountdown(parts), parts };
    if (parts.overdueMs < MINUTE) return { phase: 'due', text: 'due now', parts };
    return { phase: 'overdue', text: 'overdue by ' + describeElapsed(targetAt, now).text, parts };
  }

  /** How far through the span from `startAt` to `endAt` we are, from 0 to 1. 0 if the span is invalid. */
  function progress(startAt, endAt, now) {
    const start = toMs(startAt);
    const end = toMs(endAt);
    const current = toMs(now);
    if ([start, end, current].some(Number.isNaN) || end <= start) return 0;
    return Math.min(1, Math.max(0, (current - start) / (end - start)));
  }

  /** "Oct 17, 2026". Always UTC, so every visitor reads the same date. */
  function formatDate(value) {
    const ms = toMs(value);
    if (Number.isNaN(ms)) return '';
    return new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  /**
   * Lets a visitor (or the owner) preview the page at another moment with ?previewNow=...
   * Accepts an ISO date/time ("2026-10-19T09:00:00Z") or an offset from now ("+2d", "-3h", "+90m").
   * Anything else is ignored.
   * @returns {{now: number, isPreview: boolean}}
   */
  function resolveNow(search, realNow) {
    const match = /(?:^|[?&])previewNow=([^&]+)/.exec(search || '');
    if (!match) return { now: realNow, isPreview: false };
    // In a query string a "+" may arrive as a space, so restore it before trimming.
    const raw = decodeURIComponent(match[1]).replace(/^ /, '+').trim();
    const offset = /^([+-])(\d+)([dhm])$/.exec(raw);
    if (offset) {
      const unit = { d: DAY, h: HOUR, m: MINUTE }[offset[3]];
      const sign = offset[1] === '-' ? -1 : 1;
      return { now: realNow + sign * Number(offset[2]) * unit, isPreview: true };
    }
    const absolute = Date.parse(raw);
    return Number.isNaN(absolute) ? { now: realNow, isPreview: false } : { now: absolute, isPreview: true };
  }

  return { toMs, describeElapsed, liveFor, releasedAgo, countdown, formatCountdown, describeTarget, progress, formatDate, resolveNow };
});
