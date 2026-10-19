import { describe, expect, it } from 'vitest';
import type { ISODate } from '@/core/date';
import { migrate } from '@/core/store/migrations';
import { at, dayOf, fromClock, isNight, lateness, latency, sleepDuration, sleepStats, span, type SleepEntry } from './model';

const D = (s: string): ISODate => s as ISODate;

const session = (bed: number, asleep: number | null, wake: number | null): SleepEntry => ({
  id: 'x',
  createdAt: 0,
  updatedAt: 0,
  bedAt: bed,
  asleepAt: asleep,
  wakeAt: wake,
  plannedBed: 23 * 60,
  plannedWake: 7 * 60,
});

describe('sleep', () => {
  it('clock helpers wrap past midnight', () => {
    expect(span(23 * 60, 7 * 60)).toBe(8 * 60);
    expect(lateness(40, 23 * 60 + 30)).toBe(70);
    expect(lateness(22 * 60 + 30, 23 * 60)).toBe(-30);
  });

  it('reads form clock times back from the wake-up', () => {
    const t = fromClock(D('2026-10-20'), 7 * 60, 10, 23 * 60 + 30);
    expect(t.wakeAt).toBe(at(D('2026-10-20'), 7 * 60));
    expect(t.asleepAt).toBe(at(D('2026-10-20'), 10));
    expect(t.bedAt).toBe(at(D('2026-10-19'), 23 * 60 + 30));
  });

  it('a nap from lunch to evening is a normal session of that day', () => {
    const t = fromClock(D('2026-10-19'), 19 * 60, 13 * 60 + 20, 13 * 60);
    const nap = session(t.bedAt, t.asleepAt, t.wakeAt);
    expect(sleepDuration(nap)).toBe(5 * 60 + 40);
    expect(latency(nap)).toBe(20);
    expect(dayOf(nap)).toBe('2026-10-19');
    expect(isNight(nap)).toBe(false);
  });

  it('sums a night and a nap per day, stats look at nights only for bedtime', () => {
    const n = fromClock(D('2026-10-20'), 7 * 60, 10, 23 * 60 + 40);
    const p = fromClock(D('2026-10-20'), 15 * 60, 14 * 60, 14 * 60);
    const s = sleepStats([session(n.bedAt, n.asleepAt, n.wakeAt), session(p.bedAt, p.asleepAt, p.wakeAt)]);
    expect(s.days).toBe(1);
    expect(s.duration).toBe(6 * 60 + 50 + 60);
    expect(s.bedDelay).toBe(40);
    expect(s.asleepAt).toBe(10);
    expect(s.naps).toBe(1);
    expect(s.napTime).toBe(60);
    expect(s.debt).toBe(8 * 60 - (7 * 60 + 50));
  });

  it('migrates v1 nights (clock minutes under the morning date) to sessions', () => {
    const out = migrate(
      {
        collections: {
          sleepLog: [{ id: 'a', createdAt: 1, updatedAt: 1, date: '2026-10-20', plannedBed: 1380, plannedWake: 420, bedAt: 1410, asleepAt: 15, wakeAt: 425 }],
        },
        docs: {},
      },
      1,
    );
    expect(out.collections.sleepLog).toEqual([
      { id: 'a', createdAt: 1, updatedAt: 1, plannedBed: 1380, plannedWake: 420, bedAt: at(D('2026-10-19'), 1410), asleepAt: at(D('2026-10-20'), 15), wakeAt: at(D('2026-10-20'), 425) },
    ]);
  });
});
