import type { Minutes } from '@/core/date';
import type { TimelineSegment } from '@/core/timeline';

/** Show the card this long before it's time to leave. */
const HEADS_UP = 30;

export interface Departure {
  leaveAt: Minutes;
  /** Travel minutes. */
  trip: Minutes;
  to: string;
  /** What you're going to, and when it starts. */
  title: string;
  startsAt: Minutes;
  /** Minutes until leaving; ≤ 0 means "go now". */
  inMin: number;
  /** Minutes you'd be late by if you left right now. */
  lateIfNow: number;
}

/** The next trip of today, if leaving is due within HEADS_UP minutes (or overdue but still catchable). */
export function nextDeparture(segments: readonly TimelineSegment[], now: Minutes): Departure | null {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.kind !== 'travel' || seg.unknown || seg.end <= now) continue;
    const target = segments.slice(i + 1).find((s) => s.kind === 'busy');
    if (!target || target.kind !== 'busy' || target.start <= now) continue;
    const trip = seg.end - seg.start;
    const inMin = seg.start - now;
    if (inMin > HEADS_UP) return null;
    return { leaveAt: seg.start, trip, to: seg.to, title: target.block.title, startsAt: target.start, inMin, lateIfNow: Math.max(0, now + trip - target.start) };
  }
  return null;
}

/**
 * The first trip from home that day (what the wake-up time is for) and whether
 * the wake-up leaves enough time for it. Without a home, the first trip at all.
 */
export function firstTrip(segments: readonly TimelineSegment[], homeId: string | null, arriveEarly = 0): { leaveAt: Minutes; late: Minutes; title: string; startsAt: Minutes } | null {
  const i = segments.findIndex((s) => s.kind === 'travel' && !s.unknown && (homeId === null || s.from === homeId));
  const trip = segments[i];
  const target = segments.slice(i + 1).find((s) => s.kind === 'busy');
  if (i === -1 || !trip || trip.kind !== 'travel' || !target || target.kind !== 'busy') return null;
  // When the awake window starts too late the trip is pushed back (lateness): then the
  // required departure is computed from the start, the trip and the arrive-early buffer.
  const leaveAt = trip.late > 0 ? target.start - (trip.end - trip.start) - arriveEarly : trip.start;
  return { leaveAt, late: trip.late, title: target.block.title, startsAt: target.start };
}
