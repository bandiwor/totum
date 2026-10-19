import { addDays, diffDays, weekday, type ISODate } from './date';

/**
 * A repeating N-day template: class timetable (14 days), training program (7),
 * meal plan (3), work shifts (2/2 → 4)… The single engine behind every
 * "repeats every N days" feature.
 */
export interface Cycle<TDay> {
  /** The date that is day #0 of the cycle. */
  anchor: ISODate;
  /** Template days; the cycle length is `days.length`. */
  days: TDay[];
  /** Label days as weekdays (only meaningful when length is a multiple of 7 and the anchor is a Monday). */
  weekAligned: boolean;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Index of the template day for a date. Works for dates before the anchor too. */
export function cycleDayIndex(cycle: Pick<Cycle<unknown>, 'anchor' | 'days'>, date: ISODate): number {
  if (cycle.days.length === 0) throw new Error('Empty cycle');
  return mod(diffDays(cycle.anchor, date), cycle.days.length);
}

export function cycleDay<TDay>(cycle: Cycle<TDay>, date: ISODate): TDay {
  return cycle.days[cycleDayIndex(cycle, date)] as TDay;
}

/** Human label for a template day: "Пн · нед. 2" for week-aligned cycles, "День 3" otherwise. */
export function cycleDayLabel(cycle: Pick<Cycle<unknown>, 'anchor' | 'days' | 'weekAligned'>, index: number): string {
  if (cycle.weekAligned && cycle.days.length % 7 === 0) {
    const names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const name = names[(weekday(cycle.anchor) + index) % 7] ?? '';
    const weeks = cycle.days.length / 7;
    return weeks > 1 ? `${name} · нед. ${Math.floor(index / 7) + 1}` : name;
  }
  return `День ${index + 1}`;
}

/** The next date on or after `from` that falls on template day `index`. */
export function nextDateForCycleDay(cycle: Pick<Cycle<unknown>, 'anchor' | 'days'>, index: number, from: ISODate): ISODate {
  const current = cycleDayIndex(cycle, from);
  return addDays(from, mod(index - current, cycle.days.length));
}

/** Changes the cycle length while keeping existing day contents. */
export function resizeCycle<TDay>(cycle: Cycle<TDay>, length: number, makeDay: () => TDay): Cycle<TDay> {
  if (length < 1) throw new Error('Cycle length must be ≥ 1');
  const days = cycle.days.slice(0, length);
  while (days.length < length) days.push(makeDay());
  return { ...cycle, days };
}
