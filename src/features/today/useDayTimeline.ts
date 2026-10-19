import { computed, type ReadonlySignal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import type { ISODate } from '@/core/date';
import { registry } from '@/core/registry';
import { settings } from '@/core/settings';
import { buildTimeline, summarizeFreeTime, type FreeTimeSummary, type TimelineSegment } from '@/core/timeline';
import { homeId, travelMinutes } from '@/features/places/model';

export interface DayTimeline {
  segments: TimelineSegment[];
  free: FreeTimeSummary;
}

export function dayTimeline(date: ISODate): DayTimeline {
  const s = settings.value.value;
  const segments = buildTimeline(registry.busyBlocks(date), {
    dayStart: s.dayStart,
    dayEnd: s.dayEnd,
    homeId: homeId.value,
    minHomeStay: s.minHomeStay,
    travel: travelMinutes,
  });
  return { segments, free: summarizeFreeTime(segments) };
}

/** Reactive timeline for a date: recomputes when any source data changes. */
export function useDayTimeline(date: ISODate): ReadonlySignal<DayTimeline> {
  return useMemo(() => computed(() => dayTimeline(date)), [date]);
}
