import { signal } from '@preact/signals';
import { addMonths, compareDates, today } from '@/core/date';
import type { WorkoutSession } from './model';
import { t } from '@/core/i18n';

export type Period = '1m' | '3m' | '6m' | 'all';
const PERIOD_VALUES: readonly Period[] = ['1m', '3m', '6m', 'all'];
export const periodOptions = (): { value: Period; label: string }[] =>
  PERIOD_VALUES.map((value) => ({ value, label: t(`training.periods.${value}`) }));

/** Shared across progress screens so switching screens keeps the range. */
export const period = signal<Period>('3m');

export function inPeriod(list: readonly WorkoutSession[], p: Period): WorkoutSession[] {
  if (p === 'all') return [...list];
  const from = addMonths(today(), p === '1m' ? -1 : p === '3m' ? -3 : -6);
  return list.filter((s) => compareDates(s.date, from) >= 0);
}
