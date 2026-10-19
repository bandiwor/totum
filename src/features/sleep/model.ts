import * as v from 'valibot';
import { computed } from '@preact/signals';
import { addDays, compareDates, today, type ISODate, type Minutes } from '@/core/date';
import { settings } from '@/core/settings';
import { entityFields, isoDate, minutes } from '@/core/store/schema';
import { defineCollection, type Entity } from '@/core/store/store';

/**
 * One night, filed under the morning it ends (`date`). The plan is copied from
 * settings at the time (Отбой/Подъём), so changing the plan later doesn't
 * rewrite history. Times are minutes of the day; spans wrap past midnight.
 */
export interface SleepEntry extends Entity {
  date: ISODate;
  plannedBed: Minutes;
  plannedWake: Minutes;
  /** Went to bed / wanted to sleep ("Ложусь спать"). */
  bedAt: Minutes | null;
  /** Roughly fell asleep — usually corrected in the morning. */
  asleepAt: Minutes | null;
  wakeAt: Minutes | null;
}

const nullableMinutes = v.nullable(minutes);

export const sleepLog = defineCollection<SleepEntry>('sleepLog', {
  label: 'collections.sleepLog',
  schema: v.object({
    ...entityFields,
    date: isoDate,
    plannedBed: minutes,
    plannedWake: minutes,
    bedAt: nullableMinutes,
    asleepAt: nullableMinutes,
    wakeAt: nullableMinutes,
  }),
});

export const DAY = 1440;

/** Forward distance from `from` to `to` on a 24-hour clock. */
export const span = (from: Minutes, to: Minutes): Minutes => (((to - from) % DAY) + DAY) % DAY;

/** Signed difference "actual − planned" for evening times, in −12h…+12h. */
export function lateness(actual: Minutes, planned: Minutes): number {
  const d = span(planned, actual);
  return d > DAY / 2 ? d - DAY : d;
}

/** Evening clock times counted from noon, so 23:30 and 00:30 average to midnight. */
const fromNoon = (m: Minutes): number => (m < DAY / 2 ? m + DAY : m);
const toClock = (x: number): Minutes => Math.round(x) % DAY;

export function plannedDuration(bed: Minutes, wake: Minutes): Minutes {
  return span(bed, wake);
}

export function sleepDuration(e: SleepEntry): Minutes | null {
  const start = e.asleepAt ?? e.bedAt;
  return start === null || e.wakeAt === null ? null : span(start, e.wakeAt);
}

/** From "going to sleep" to actually asleep. */
export function latency(e: SleepEntry): Minutes | null {
  return e.bedAt === null || e.asleepAt === null ? null : span(e.bedAt, e.asleepAt);
}

/** The morning a night started now is filed under: after noon it's tomorrow. */
export function nightDate(now: Minutes, date: ISODate = today()): ISODate {
  return now >= DAY / 2 ? addDays(date, 1) : date;
}

export const sortedSleep = computed(() => [...sleepLog.all.value].sort((a, b) => compareDates(b.date, a.date)));

export function entryFor(date: ISODate): SleepEntry | undefined {
  return sleepLog.all.value.find((e) => e.date === date);
}

const mean = (xs: readonly number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const present = <T>(xs: readonly (T | null)[]): T[] => xs.filter((x): x is T => x !== null);

export interface SleepStats {
  nights: number;
  duration: number | null;
  latency: number | null;
  /** Average of (went to bed − planned bedtime). */
  bedDelay: number | null;
  /** Average time of falling asleep (clock minutes). */
  asleepAt: Minutes | null;
  /** Mean absolute deviation of falling-asleep time — lower is steadier. */
  spread: number | null;
  /** Planned sleep minus actual sleep, summed over the nights. */
  debt: number | null;
}

export function sleepStats(entries: readonly SleepEntry[]): SleepStats {
  const complete = entries.filter((e) => sleepDuration(e) !== null);
  const durations = present(complete.map(sleepDuration));
  const asleep = present(entries.map((e) => e.asleepAt ?? e.bedAt)).map(fromNoon);
  const avgAsleep = mean(asleep);
  return {
    nights: complete.length,
    duration: mean(durations),
    latency: mean(present(entries.map(latency))),
    bedDelay: mean(present(entries.map((e) => (e.bedAt === null ? null : lateness(e.bedAt, e.plannedBed))))),
    asleepAt: avgAsleep === null ? null : toClock(avgAsleep),
    spread: avgAsleep === null ? null : mean(asleep.map((x) => Math.abs(x - avgAsleep))),
    debt: complete.length ? complete.reduce((s, e) => s + plannedDuration(e.plannedBed, e.plannedWake) - (sleepDuration(e) ?? 0), 0) : null,
  };
}

/** Nights whose morning falls within the last `days` days (including today). */
export function recentNights(days: number, base: ISODate = today()): SleepEntry[] {
  const from = addDays(base, -(days - 1));
  return sortedSleep.value.filter((e) => compareDates(e.date, from) >= 0 && compareDates(e.date, base) <= 0);
}

// ── Actions ────────────────────────────────────────────────────────────────

function plan(): { plannedBed: Minutes; plannedWake: Minutes } {
  const s = settings.value.value;
  return { plannedBed: s.dayEnd, plannedWake: s.dayStart };
}

/** "Ложусь спать": starts tonight's entry (or restarts it). */
export function goToBed(now: Minutes): SleepEntry {
  const date = nightDate(now);
  const cur = entryFor(date);
  if (cur) return sleepLog.update(cur.id, { bedAt: now, asleepAt: null, wakeAt: null }) ?? cur;
  return sleepLog.add({ date, ...plan(), bedAt: now, asleepAt: null, wakeAt: null });
}

export function saveNight(date: ISODate, times: { bedAt: Minutes | null; asleepAt: Minutes | null; wakeAt: Minutes | null }): void {
  const cur = entryFor(date);
  if (cur) sleepLog.update(cur.id, times);
  else sleepLog.add({ date, ...plan(), ...times });
}

/** Typical time to fall asleep (for defaults), 15 min without history. */
export const typicalLatency = computed((): Minutes => {
  const l = sleepStats(sortedSleep.value.slice(0, 14)).latency;
  return l === null ? 15 : Math.round(l / 5) * 5;
});
