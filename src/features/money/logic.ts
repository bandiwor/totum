import { addDays, addMonths, compareDates, diffDays, type ISODate } from '@/core/date';
import type { Goal, Recurring, Transaction } from './model';

/** "YYYY-MM". */
export type MonthKey = string;

export const monthOf = (d: ISODate): MonthKey => d.slice(0, 7);
export const monthStart = (m: MonthKey): ISODate => `${m}-01` as ISODate;
export const shiftMonth = (m: MonthKey, n: number): MonthKey => monthOf(addMonths(monthStart(m), n));
export const monthEnd = (m: MonthKey): ISODate => addDays(monthStart(shiftMonth(m, 1)), -1);

/** Occurrence dates of a recurring payment within [from, to]. */
export function occurrences(r: Pick<Recurring, 'period' | 'every' | 'anchor' | 'endDate'>, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const last = r.endDate && compareDates(r.endDate, to) < 0 ? r.endDate : to;
  for (let i = 0; i < 10_000; i++) {
    const d =
      r.period === 'month' ? addMonths(r.anchor, i * r.every) : addDays(r.anchor, i * r.every * (r.period === 'week' ? 7 : 1));
    if (compareDates(d, last) > 0) break;
    if (compareDates(d, from) >= 0) out.push(d);
  }
  return out;
}

/** How an expense/income is attributed to months (spread evenly over `spreadMonths`). */
export function allocate(tx: Pick<Transaction, 'date' | 'amount' | 'spreadMonths'>): { month: MonthKey; amount: number }[] {
  const n = Math.max(1, tx.spreadMonths);
  return Array.from({ length: n }, (_, i) => ({ month: shiftMonth(monthOf(tx.date), i), amount: tx.amount / n }));
}

export interface MonthTotals {
  income: number;
  expense: number;
  byCategory: Map<string | null, number>;
}

/** Done transactions attributed to a month (expenses spread over their months). */
export function monthTotals(list: readonly Transaction[], month: MonthKey): MonthTotals {
  const t: MonthTotals = { income: 0, expense: 0, byCategory: new Map() };
  for (const tx of list) {
    if (tx.status !== 'done') continue;
    for (const part of allocate(tx)) {
      if (part.month !== month) continue;
      if (tx.type === 'income') t.income += part.amount;
      else {
        t.expense += part.amount;
        t.byCategory.set(tx.categoryId, (t.byCategory.get(tx.categoryId) ?? 0) + part.amount);
      }
    }
  }
  return t;
}

/** Cash balance: opening + all done incomes − all done expenses (paid in full on their date). */
export function balance(opening: number, list: readonly Transaction[]): number {
  return list.reduce((s, tx) => (tx.status !== 'done' ? s : tx.type === 'income' ? s + tx.amount : s - tx.amount), opening);
}

export interface GoalForecast {
  saved: number;
  left: number;
  /** Needed per month to hit the deadline. */
  perMonth: number | null;
  /** Projected date at the given monthly pace. */
  eta: ISODate | null;
  onTrack: boolean | null;
}

export function goalForecast(goal: Pick<Goal, 'target' | 'deadline'>, saved: number, monthlyPace: number, today: ISODate): GoalForecast {
  const left = Math.max(0, goal.target - saved);
  const monthsLeft = goal.deadline ? Math.max(0, diffDays(today, goal.deadline) / 30.44) : null;
  const perMonth = monthsLeft === null ? null : left === 0 ? 0 : monthsLeft < 1 ? left : left / monthsLeft;
  const eta = left === 0 ? today : monthlyPace > 0 ? addDays(today, Math.ceil((left / monthlyPace) * 30.44)) : null;
  const onTrack = goal.deadline === null ? null : left === 0 || (eta !== null && compareDates(eta, goal.deadline) <= 0);
  return { saved, left, perMonth, eta, onTrack };
}
