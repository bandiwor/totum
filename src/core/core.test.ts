import { describe, expect, it } from 'vitest';
import { addDays, addMonths, diffDays, formatDuration, isISODate, parseTime, toISODate, weekday } from './date';
import { cycleDayIndex, cycleDayLabel, nextDateForCycleDay, type Cycle } from './cycle';
import { resolveDay } from './plan';
import { buildTimeline, summarizeFreeTime, type BusyBlock } from './timeline';

const d = toISODate;

describe('date', () => {
  it('validates', () => {
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
  });
  it('arithmetics across DST and years', () => {
    expect(addDays(d('2026-03-28'), 2)).toBe('2026-03-30');
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(diffDays(d('2026-01-01'), d('2027-01-01'))).toBe(365);
    expect(addMonths(d('2026-01-31'), 1)).toBe('2026-02-28');
  });
  it('weekday: Monday = 0', () => {
    expect(weekday(d('2026-10-19'))).toBe(0);
    expect(weekday(d('2026-10-25'))).toBe(6);
  });
  it('time', () => {
    expect(parseTime('08:30')).toBe(510);
    expect(formatDuration(100)).toBe('1 ч 40 мин');
  });
});

describe('cycle', () => {
  const twoWeeks: Cycle<number> = { anchor: d('2026-09-01'), days: Array.from({ length: 14 }, (_, i) => i), weekAligned: true };
  it('maps dates to days, including before the anchor', () => {
    expect(cycleDayIndex(twoWeeks, d('2026-09-01'))).toBe(0);
    expect(cycleDayIndex(twoWeeks, d('2026-09-15'))).toBe(0);
    expect(cycleDayIndex(twoWeeks, d('2026-08-31'))).toBe(13);
  });
  it('labels', () => {
    expect(cycleDayLabel(twoWeeks, 8)).toBe('Ср · нед. 2');
    expect(cycleDayLabel({ anchor: d('2026-09-01'), days: [1, 2, 3], weekAligned: false }, 2)).toBe('День 3');
  });
  it('finds the next date for a day', () => {
    expect(nextDateForCycleDay(twoWeeks, 2, d('2026-09-05'))).toBe('2026-09-17');
  });
});

describe('plan overrides', () => {
  it('adds, cancels and modifies without touching the template', () => {
    const template = [
      { key: 'a', data: { t: 1 } },
      { key: 'b', data: { t: 2 } },
    ];
    const day = resolveDay(template, [
      { kind: 'cancel', date: d('2026-10-22'), key: 'a' },
      { kind: 'modify', date: d('2026-10-22'), key: 'b', patch: { t: 5 } },
      { kind: 'add', date: d('2026-10-22'), key: 'x', data: { t: 9 } },
    ]);
    expect(day.map((i) => [i.key, i.data.t, i.origin])).toEqual([
      ['b', 5, 'template'],
      ['x', 9, 'added'],
    ]);
    expect(template[1]?.data.t).toBe(2);
  });
});

describe('timeline', () => {
  const routes: Record<string, number> = { 'home>uni': 40, 'uni>home': 40, 'uni>gym': 15, 'gym>home': 20, 'home>gym': 20 };
  const opts = {
    dayStart: 7 * 60,
    dayEnd: 23 * 60,
    homeId: 'home',
    minHomeStay: 30,
    travel: (a: string, b: string) => routes[`${a}>${b}`],
  };
  const block = (id: string, start: string, end: string, placeId: string | null): BusyBlock => ({
    id, source: 't', title: id, start: parseTime(start), end: parseTime(end), placeId,
  });

  it('accounts for travel and goes straight from uni to gym when going home is not worth it', () => {
    const segs = buildTimeline([block('pair', '09:00', '10:30', 'uni'), block('gym', '11:00', '12:30', 'gym')], opts);
    expect(segs.map((s) => s.kind)).toEqual(['free', 'travel', 'busy', 'free', 'travel', 'busy', 'travel', 'free']);
    const s = summarizeFreeTime(segs);
    expect(s.travel).toBe(40 + 15 + 20);
    expect(segs[1]).toMatchObject({ start: parseTime('08:20') });
  });

  it('goes home in a long gap', () => {
    const segs = buildTimeline([block('p1', '09:00', '10:30', 'uni'), block('p2', '15:00', '16:30', 'uni')], opts);
    const free = segs.filter((s) => s.kind === 'free');
    expect(free.some((s) => s.kind === 'free' && s.atHome && s.start === parseTime('11:10'))).toBe(true);
  });

  it('flags lateness when the gap is too short', () => {
    const segs = buildTimeline([block('p1', '09:00', '10:30', 'uni'), block('p2', '10:35', '11:00', 'gym')], opts);
    const t = segs.find((s) => s.kind === 'travel' && s.to === 'gym');
    expect(t).toMatchObject({ late: 10 });
  });
});
