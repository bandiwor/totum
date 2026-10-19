import { signal } from '@preact/signals';
import { addMonths, compareDates, today } from '@/core/date';
import type { WorkoutSession } from './model';

export type Period = '1m' | '3m' | '6m' | 'all';
export const PERIODS = [
  { value: '1m', label: '1 мес' },
  { value: '3m', label: '3 мес' },
  { value: '6m', label: '6 мес' },
  { value: 'all', label: 'Всё' },
] as const;

/** Shared across progress screens so switching screens keeps the range. */
export const period = signal<Period>('3m');

export function inPeriod(list: readonly WorkoutSession[], p: Period): WorkoutSession[] {
  if (p === 'all') return [...list];
  const from = addMonths(today(), p === '1m' ? -1 : p === '3m' ? -3 : -6);
  return list.filter((s) => compareDates(s.date, from) >= 0);
}
