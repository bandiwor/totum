import { describe, expect, it } from 'vitest';
import { parseTime } from '@/core/date';
import { buildTimeline, type BusyBlock } from '@/core/timeline';
import { nextDeparture } from './leave';

const block = (start: string, end: string, placeId: string): BusyBlock => ({ id: 'b', source: 't', title: 'Физика', start: parseTime(start), end: parseTime(end), placeId });
const segs = buildTimeline([block('13:50', '15:20', 'uni')], {
  dayStart: 420,
  dayEnd: 1410,
  homeId: 'home',
  minHomeStay: 30,
  travel: (a, b) => (a !== b ? 40 : undefined),
  arriveEarly: 10,
});

describe('nextDeparture', () => {
  it('stays quiet until 30 minutes before leaving', () => {
    expect(nextDeparture(segs, parseTime('12:00'))).toBeNull();
  });
  it('counts down, then says go now, then shows how late you would be', () => {
    expect(nextDeparture(segs, parseTime('12:50'))).toMatchObject({ inMin: 10, trip: 40, startsAt: parseTime('13:50'), lateIfNow: 0 });
    expect(nextDeparture(segs, parseTime('13:00'))).toMatchObject({ inMin: 0, lateIfNow: 0 });
    expect(nextDeparture(segs, parseTime('13:20'))).toMatchObject({ lateIfNow: 10 });
  });
  it('is gone once the class has started', () => {
    expect(nextDeparture(segs, parseTime('13:55'))).toBeNull();
  });
});
