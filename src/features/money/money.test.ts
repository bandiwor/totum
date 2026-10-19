import { describe, expect, it } from 'vitest';
import { toISODate } from '@/core/date';
import { allocate, balance, goalForecast, monthTotals, occurrences } from './logic';
import type { Transaction } from './model';

const d = toISODate;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(), createdAt: 0, updatedAt: 0, date: d('2026-10-05'), type: 'expense', amount: 0, categoryId: null,
  note: '', spreadMonths: 1, status: 'done', recurringId: null, jobId: null, ...o,
});

describe('money', () => {
  it('recurring occurrences', () => {
    expect(occurrences({ period: 'month', every: 1, anchor: d('2026-01-31'), endDate: null }, d('2026-02-01'), d('2026-04-30'))).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
    expect(occurrences({ period: 'week', every: 2, anchor: d('2026-10-01'), endDate: null }, d('2026-10-01'), d('2026-10-31'))).toEqual(['2026-10-01', '2026-10-15', '2026-10-29']);
    expect(occurrences({ period: 'days', every: 10, anchor: d('2026-10-01'), endDate: d('2026-10-15') }, d('2026-10-01'), d('2026-12-31'))).toEqual(['2026-10-01', '2026-10-11']);
  });

  it('spreads a 3-month course over months, but the balance pays it at once', () => {
    const course = tx({ amount: 30000, spreadMonths: 3, date: d('2026-11-20') });
    expect(allocate(course).map((a) => [a.month, a.amount])).toEqual([['2026-11', 10000], ['2026-12', 10000], ['2027-01', 10000]]);
    const list = [course, tx({ type: 'income', amount: 50000 }), tx({ amount: 5000, status: 'planned' })];
    expect(monthTotals(list, '2026-12').expense).toBe(10000);
    expect(monthTotals(list, '2026-10').income).toBe(50000);
    expect(balance(1000, list)).toBe(1000 + 50000 - 30000);
  });

  it('goal forecast', () => {
    const f = goalForecast({ target: 100000, deadline: d('2027-04-19') }, 40000, 12000, d('2026-10-19'));
    expect(f.left).toBe(60000);
    expect(f.perMonth).toBeCloseTo(60000 / (182 / 30.44));
    expect(f.onTrack).toBe(true);
    expect(goalForecast({ target: 100000, deadline: d('2026-12-19') }, 40000, 10000, d('2026-10-19')).onTrack).toBe(false);
  });
});
