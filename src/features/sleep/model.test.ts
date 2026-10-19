import { describe, expect, it } from 'vitest';
import type { ISODate } from '@/core/date';
import { lateness, latency, nightDate, sleepDuration, sleepStats, span, type SleepEntry } from './model';

const night = (p: Partial<SleepEntry>): SleepEntry => ({
  id: 'x',
  createdAt: 0,
  updatedAt: 0,
  date: '2026-10-19' as ISODate,
  plannedBed: 23 * 60,
  plannedWake: 7 * 60,
  bedAt: null,
  asleepAt: null,
  wakeAt: null,
  ...p,
});

describe('sleep', () => {
  it('spans wrap past midnight', () => {
    expect(span(23 * 60, 7 * 60)).toBe(8 * 60);
    expect(span(30, 7 * 60)).toBe(6 * 60 + 30);
  });

  it('lateness is signed around the planned time', () => {
    expect(lateness(23 * 60 + 40, 23 * 60)).toBe(40);
    expect(lateness(22 * 60 + 30, 23 * 60)).toBe(-30);
    expect(lateness(40, 23 * 60 + 30)).toBe(70);
  });

  it('duration counts from falling asleep, latency from going to bed', () => {
    const e = night({ bedAt: 23 * 60 + 30, asleepAt: 10, wakeAt: 7 * 60 + 10 });
    expect(latency(e)).toBe(40);
    expect(sleepDuration(e)).toBe(7 * 60);
    expect(sleepDuration(night({ bedAt: 23 * 60, wakeAt: 7 * 60 }))).toBe(8 * 60);
    expect(sleepDuration(night({ bedAt: 23 * 60 }))).toBeNull();
  });

  it('a night started in the evening belongs to the next morning', () => {
    expect(nightDate(23 * 60, '2026-10-19' as ISODate)).toBe('2026-10-20');
    expect(nightDate(60, '2026-10-20' as ISODate)).toBe('2026-10-20');
  });

  it('averages times across midnight and sums sleep debt', () => {
    const s = sleepStats([
      night({ bedAt: 23 * 60 + 30, asleepAt: 23 * 60 + 50, wakeAt: 7 * 60 }),
      night({ bedAt: 23 * 60 + 50, asleepAt: 10, wakeAt: 7 * 60 }),
    ]);
    expect(s.nights).toBe(2);
    expect(s.asleepAt).toBe(0);
    expect(s.spread).toBe(10);
    expect(s.latency).toBe(20);
    expect(s.bedDelay).toBe(40);
    expect(s.debt).toBe(8 * 60 * 2 - (7 * 60 + 10) - (6 * 60 + 50));
  });
});
