import * as v from 'valibot';
import { computed } from '@preact/signals';
import { addDays, compareDates, fromLocalDate, today, type ISODate, type Minutes } from '@/core/date';
import { settings } from '@/core/settings';
import { wakeFor } from '@/core/dayWindow';
import { entityFields, minutes } from '@/core/store/schema';
import { defineCollection, type Entity } from '@/core/store/store';

/**
 * A sleep session at any time of day — a night, a nap after lunch, sleep after
 * a night shift. Times are absolute (epoch ms), so sessions may cross midnight
 * freely. A session counts towards the day you woke up. The plan (Отбой/Подъём)
 * is copied from settings when the session starts, so later plan changes don't
 * rewrite history.
 */
export interface SleepEntry extends Entity {
  /** Went to bed / wanted to sleep ("Ложусь спать"). */
  bedAt: number;
  /** Roughly fell asleep — usually corrected after waking; null = unknown. */
  asleepAt: number | null;
  /** Null while still asleep. */
  wakeAt: number | null;
  plannedBed: Minutes;
  plannedWake: Minutes;
}

const timestamp = v.pipe(v.number(), v.integer(), v.minValue(0));

export const sleepLog = defineCollection<SleepEntry>('sleepLog', {
  label: 'collections.sleepLog',
  schema: v.object({
    ...entityFields,
    bedAt: timestamp,
    asleepAt: v.nullable(timestamp),
    wakeAt: v.nullable(timestamp),
    plannedBed: minutes,
    plannedWake: minutes,
  }),
});

export const DAY = 1440;
const MIN = 60_000;

/** Forward distance from `from` to `to` on a 24-hour clock. */
export const span = (from: Minutes, to: Minutes): Minutes => (((to - from) % DAY) + DAY) % DAY;

/** Signed difference "actual − planned" on a clock, in −12h…+12h. */
export function lateness(actual: Minutes, planned: Minutes): number {
  const d = span(planned, actual);
  return d > DAY / 2 ? d - DAY : d;
}

export const clockOf = (ms: number): Minutes => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};
export const dateOf = (ms: number): ISODate => fromLocalDate(new Date(ms));

/** Local time `m` minutes after midnight of `date`, as epoch ms. */
export function at(date: ISODate, m: Minutes): number {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, mo - 1, d, 0, m).getTime();
}

/** Latest moment at clock time `m` that is not after `ms` — how "fell asleep at 00:20" is read back from a wake-up. */
export const before = (ms: number, m: Minutes): number => ms - span(m, clockOf(ms)) * MIN;

export function plannedDuration(bed: Minutes, wake: Minutes): Minutes {
  return span(bed, wake);
}

export function sleepDuration(e: SleepEntry): Minutes | null {
  return e.wakeAt === null ? null : Math.round((e.wakeAt - (e.asleepAt ?? e.bedAt)) / MIN);
}

/** From "going to sleep" to actually asleep. */
export function latency(e: SleepEntry): Minutes | null {
  return e.asleepAt === null ? null : Math.round((e.asleepAt - e.bedAt) / MIN);
}

/** The day a session counts towards: the wake-up day (or bedtime while still asleep). */
export const dayOf = (e: SleepEntry): ISODate => dateOf(e.wakeAt ?? e.bedAt);

/** A session is the "night" when it starts near the planned bedtime (−4h…+6h); otherwise it's a nap or shifted sleep. */
export function isNight(e: SleepEntry): boolean {
  const late = lateness(clockOf(e.asleepAt ?? e.bedAt), e.plannedBed);
  return late >= -240 && late <= 360;
}

export const sortedSleep = computed(() => [...sleepLog.all.value].sort((a, b) => b.bedAt - a.bedAt));

/** The session in progress (went to bed, not woken up yet). */
export const openSession = computed(() => sortedSleep.value.find((e) => e.wakeAt === null));

export function sessionsOn(date: ISODate): SleepEntry[] {
  return sortedSleep.value.filter((e) => dayOf(e) === date);
}

const mean = (xs: readonly number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const present = <T>(xs: readonly (T | null)[]): T[] => xs.filter((x): x is T => x !== null);
/** Evening clock times counted from noon, so 23:30 and 00:30 average to midnight. */
const fromNoon = (m: number): number => (m < DAY / 2 ? m + DAY : m);

export interface SleepStats {
  /** Days with at least one finished session. */
  days: number;
  /** Average total sleep per day (nights + naps). */
  duration: number | null;
  latency: number | null;
  /** Average of (went to bed − planned bedtime), nights only. */
  bedDelay: number | null;
  /** Average time of falling asleep at night (clock minutes). */
  asleepAt: Minutes | null;
  /** Mean absolute deviation of that time — lower is steadier. */
  spread: number | null;
  /** Planned sleep minus actual sleep, summed over the days. */
  debt: number | null;
  naps: number;
  napTime: number;
}

export function sleepStats(entries: readonly SleepEntry[]): SleepStats {
  const done = entries.filter((e) => e.wakeAt !== null);
  const perDay = new Map<ISODate, { total: number; planned: number }>();
  for (const e of done) {
    const day = perDay.get(dayOf(e)) ?? { total: 0, planned: plannedDuration(e.plannedBed, e.plannedWake) };
    day.total += sleepDuration(e) ?? 0;
    perDay.set(dayOf(e), day);
  }
  const nights = entries.filter(isNight);
  const naps = done.filter((e) => !isNight(e));
  const asleep = nights.map((e) => fromNoon(clockOf(e.asleepAt ?? e.bedAt)));
  const avgAsleep = mean(asleep);
  const days = [...perDay.values()];
  return {
    days: days.length,
    duration: mean(days.map((d) => d.total)),
    latency: mean(present(entries.map(latency))),
    bedDelay: mean(nights.map((e) => lateness(clockOf(e.bedAt), e.plannedBed))),
    asleepAt: avgAsleep === null ? null : Math.round(avgAsleep) % DAY,
    spread: avgAsleep === null ? null : mean(asleep.map((x) => Math.abs(x - avgAsleep))),
    debt: days.length ? days.reduce((s, d) => s + d.planned - d.total, 0) : null,
    naps: naps.length,
    napTime: naps.reduce((s, e) => s + (sleepDuration(e) ?? 0), 0),
  };
}

/** Sessions counted towards the last `days` days (including `base`). */
export function recentSessions(days: number, base: ISODate = today()): SleepEntry[] {
  const from = addDays(base, -(days - 1));
  return sortedSleep.value.filter((e) => compareDates(dayOf(e), from) >= 0 && compareDates(dayOf(e), base) <= 0);
}

/** Total sleep per day (minutes), for charts. */
export function totalOn(date: ISODate): number {
  return sessionsOn(date).reduce((s, e) => s + (sleepDuration(e) ?? 0), 0);
}

// ── Actions ────────────────────────────────────────────────────────────────

/** The plan for a session starting now: usual bedtime, and the wake-up set for the morning it ends. */
function plan(now: number = Date.now()): { plannedBed: Minutes; plannedWake: Minutes } {
  const s = settings.value.value;
  const morning = clockOf(now) >= DAY / 2 ? addDays(dateOf(now), 1) : dateOf(now);
  return { plannedBed: s.dayEnd, plannedWake: wakeFor(morning) };
}

/** "Ложусь спать" — at any time of day; restarts a session already in progress. */
export function goToBed(now: number = Date.now()): SleepEntry {
  const cur = openSession.value;
  if (cur) return sleepLog.update(cur.id, { bedAt: now, asleepAt: null }) ?? cur;
  return sleepLog.add({ ...plan(now), bedAt: now, asleepAt: null, wakeAt: null });
}

export interface SessionTimes {
  bedAt: number;
  asleepAt: number | null;
  wakeAt: number | null;
}

/**
 * Reads clock times entered in a form back into a session ending at `wake`
 * (date + time): asleep is the latest such time before waking, bed the latest
 * before falling asleep. Sessions are assumed shorter than a day.
 */
export function fromClock(wakeDate: ISODate, wake: Minutes, asleep: Minutes, bed: Minutes): SessionTimes {
  const wakeAt = at(wakeDate, wake);
  const asleepAt = before(wakeAt, asleep);
  return { bedAt: before(asleepAt, bed), asleepAt, wakeAt };
}

export function saveSession(id: string | null, times: SessionTimes): void {
  if (id) sleepLog.update(id, times);
  else sleepLog.add({ ...plan(times.bedAt), ...times });
}

/** Typical time to fall asleep (for defaults), 15 min without history. */
export const typicalLatency = computed((): Minutes => {
  const l = sleepStats(sortedSleep.value.slice(0, 14)).latency;
  return l === null ? 15 : Math.max(0, Math.round(l / 5) * 5);
});
