import { addDays, compareDates, today, type ISODate, type Minutes } from './date';
import { settings } from './settings';
import { defineDoc } from './store/store';

/**
 * Per-date wake-up time ("tomorrow I get up at 6:00 for the military class").
 * The awake window of that day starts then; other days use settings.dayStart.
 */
export const wakeUps = defineDoc<{ byDate: Record<string, Minutes> }>('wakeUps', { byDate: {} });

export function wakeFor(date: ISODate): Minutes {
  return wakeUps.value.value.byDate[date] ?? settings.value.value.dayStart;
}

export function hasCustomWake(date: ISODate): boolean {
  return date in wakeUps.value.value.byDate;
}

/** `null` returns the day to the usual wake-up. Entries older than two weeks are dropped. */
export function setWake(date: ISODate, minutes: Minutes | null): void {
  const keep = addDays(today(), -14);
  const byDate = Object.fromEntries(Object.entries(wakeUps.value.value.byDate).filter(([d]) => d !== date && compareDates(d as ISODate, keep) >= 0));
  if (minutes !== null && minutes !== settings.value.value.dayStart) byDate[date] = minutes;
  wakeUps.set({ byDate });
}
