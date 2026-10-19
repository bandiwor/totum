import { describe, expect, it } from 'vitest';
import { toISODate } from '@/core/date';
import { places, routes } from '@/features/places/model';
import { dayTimeline } from '@/features/today/useDayTimeline';
import { registerFeatures } from '@/core/registry';
import { cancelledLessonBlocks, lessonBlocks } from './busy';
import { lessonOverrides, lessonsFor, cancelledLessonsFor, nextLessonOf, subjects, timetables, type TemplateLesson } from './model';

const d = toISODate;
registerFeatures([{ id: 'schedule', busySources: [{ id: 'schedule', blocksFor: lessonBlocks, cancelledFor: cancelledLessonBlocks }] }]);

const math = subjects.add({ name: 'Матан', color: 'c1', teacherId: null, room: '101', placeId: null, archived: false });
const phys = subjects.add({ name: 'Физика', color: 'c2', teacherId: null, room: '', placeId: null, archived: false });
const lesson = (id: string, subjectId: string, start: number): TemplateLesson => ({
  id, subjectId, typeId: null, start, end: start + 90, bell: null, room: null, placeId: null, teacherId: null, online: false,
});

// Two-week cycle starting Monday 2026-09-07: math on Mon of week 1, physics on Mon of week 2.
const days: TemplateLesson[][] = Array.from({ length: 14 }, () => []);
days[0] = [lesson('m1', math.id, 510)];
days[7] = [lesson('p1', phys.id, 600)];
timetables.add({ name: 'Осень', startDate: d('2026-09-07'), endDate: null, cycle: { anchor: d('2026-09-07'), days, weekAligned: true } });

describe('timetable resolution', () => {
  it('follows the two-week cycle', () => {
    expect(lessonsFor(d('2026-10-19')).map((l) => l.subject?.name)).toEqual(['Матан']);
    expect(lessonsFor(d('2026-10-26')).map((l) => l.subject?.name)).toEqual(['Физика']);
    expect(lessonsFor(d('2026-09-01'))).toEqual([]);
  });

  it('applies one-date changes without touching the template', () => {
    const date = d('2026-11-02');
    lessonOverrides.modify(date, 'm1', { start: 600, end: 690 });
    expect(lessonsFor(date)[0]?.data.start).toBe(600);
    expect(lessonsFor(d('2026-11-16'))[0]?.data.start).toBe(510);

    lessonOverrides.cancel(date, 'm1');
    expect(lessonsFor(date)).toEqual([]);
    expect(cancelledLessonsFor(date).map((l) => l.key)).toEqual(['m1']);

    lessonOverrides.reset(date, 'm1');
    expect(lessonsFor(date)[0]?.data.start).toBe(510);
  });

  it('adds and removes one-off lessons', () => {
    const date = d('2026-11-03');
    const key = lessonOverrides.add(date, { ...lesson('x', phys.id, 900) });
    expect(lessonsFor(date).map((l) => l.origin)).toEqual(['added']);
    lessonOverrides.cancel(date, key);
    expect(lessonsFor(date)).toEqual([]);
    expect(cancelledLessonsFor(date)).toEqual([]);
  });

  it('finds the next lesson of a subject', () => {
    expect(nextLessonOf(phys.id, d('2026-10-19'))?.date).toBe('2026-10-26');
  });

  it('feeds the day timeline with travel', () => {
    const home = places.add({ name: 'Дом', isHome: true });
    const uni = places.add({ name: 'Корпус', isHome: false });
    routes.add({ fromId: home.id, toId: uni.id, minutes: 30, bothWays: true });
    subjects.update(math.id, { placeId: uni.id });
    const t = dayTimeline(d('2026-10-19'));
    expect(t.free.travel).toBe(60);
    expect(t.segments.find((s) => s.kind === 'travel')?.start).toBe(480 - 5) // arrive 5 min early by default;
  });
});
