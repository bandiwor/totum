import type { Minutes } from './date';

/**
 * Anything that occupies time on a given day: a class, a workout, a work shift…
 * Features produce these through `busySources` in the registry; the timeline
 * engine knows nothing about where they came from.
 */
export interface BusyBlock {
  id: string;
  /** Feature id that produced the block, e.g. "schedule", "workouts", "work". */
  source: string;
  title: string;
  subtitle?: string;
  start: Minutes;
  end: Minutes;
  /** Where it happens. `null` = wherever you already are (online class, home workout). */
  placeId: string | null;
  color?: string;
  /** Route back into the app, e.g. "#/plan/lesson/…". */
  href?: string;
}

export type TimelineSegment =
  | { kind: 'busy'; start: Minutes; end: Minutes; block: BusyBlock; overlaps: boolean }
  | {
      kind: 'travel';
      start: Minutes;
      end: Minutes;
      from: string;
      to: string;
      /** Minutes you would be late by if the gap is shorter than the trip. */
      late: Minutes;
    }
  | { kind: 'free'; start: Minutes; end: Minutes; placeId: string | null; atHome: boolean };

export interface TimelineOptions {
  /** Awake window. */
  dayStart: Minutes;
  dayEnd: Minutes;
  /** The place the day starts and ends at. */
  homeId: string | null;
  /** Go home between blocks only if you'd spend at least this long there. */
  minHomeStay: Minutes;
  /** Travel time between two places; `undefined` when unknown (treated as 0). */
  travel: (from: string, to: string) => Minutes | undefined;
}

/**
 * Builds the day: busy blocks, travel between places (directly or via home when
 * it's worth it), and the free windows that remain.
 */
export function buildTimeline(blocks: readonly BusyBlock[], o: TimelineOptions): TimelineSegment[] {
  const sorted = blocks.filter((b) => b.end > b.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const segments: TimelineSegment[] = [];
  const home = o.homeId;
  let cursor = o.dayStart;
  let location: string | null = home;

  const trip = (from: string | null, to: string | null): Minutes =>
    from === null || to === null || from === to ? 0 : (o.travel(from, to) ?? 0);

  const free = (start: Minutes, end: Minutes, placeId: string | null): void => {
    const s = Math.max(start, o.dayStart);
    const e = Math.min(end, o.dayEnd);
    // Without a configured home, "wherever you are" counts as home.
    if (e - s >= 1) segments.push({ kind: 'free', start: s, end: e, placeId, atHome: placeId === home });
  };

  const travel = (from: string | null, to: string | null, start: Minutes, minutes: Minutes, latestEnd: Minutes): Minutes => {
    if (from === null || to === null || from === to || minutes <= 0) return start;
    const end = start + minutes;
    segments.push({ kind: 'travel', start, end, from, to, late: Math.max(0, end - latestEnd) });
    return end;
  };

  for (const block of sorted) {
    const target = block.placeId ?? location;

    if (block.start < cursor) {
      segments.push({ kind: 'busy', start: block.start, end: block.end, block, overlaps: true });
      cursor = Math.max(cursor, block.end);
      location = target;
      continue;
    }

    const gap = block.start - cursor;
    const canGoHome = home !== null && location !== null && location !== home && target !== home;
    const toHome = canGoHome ? trip(location, home) : 0;
    const fromHome = canGoHome ? trip(home, target) : 0;

    if (canGoHome && gap - toHome - fromHome >= o.minHomeStay) {
      const arrived = travel(location, home, cursor, toHome, block.start);
      free(arrived, block.start - fromHome, home);
      travel(home, target, block.start - fromHome, fromHome, block.start);
    } else {
      const direct = trip(location, target);
      const leaveAt = Math.max(cursor, block.start - direct);
      free(cursor, leaveAt, location);
      travel(location, target, leaveAt, direct, block.start);
    }

    segments.push({ kind: 'busy', start: block.start, end: block.end, block, overlaps: false });
    cursor = block.end;
    location = target;
  }

  if (location !== home) cursor = travel(location, home, cursor, trip(location, home), o.dayEnd);
  free(cursor, o.dayEnd, home);
  return segments;
}

export interface FreeTimeSummary {
  total: Minutes;
  atHome: Minutes;
  away: Minutes;
  travel: Minutes;
  longest: Minutes;
}

export function summarizeFreeTime(segments: readonly TimelineSegment[]): FreeTimeSummary {
  const s: FreeTimeSummary = { total: 0, atHome: 0, away: 0, travel: 0, longest: 0 };
  for (const seg of segments) {
    const len = seg.end - seg.start;
    if (seg.kind === 'travel') s.travel += len;
    if (seg.kind !== 'free') continue;
    s.total += len;
    if (seg.atHome) s.atHome += len;
    else s.away += len;
    s.longest = Math.max(s.longest, len);
  }
  return s;
}
