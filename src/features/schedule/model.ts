import * as v from 'valibot';
import { computed } from '@preact/signals';
import { cycleDay, type Cycle } from '@/core/cycle';
import { addDays, compareDates, type ISODate, type Minutes } from '@/core/date';
import { resolveDay } from '@/core/plan';
import { defineOverrides } from '@/core/store/overrides';
import { cycleSchema, entityFields, isoDate, minutes } from '@/core/store/schema';
import { defineCollection, defineDoc, type Entity } from '@/core/store/store';

// ── Subjects & lesson types ────────────────────────────────────────────────

export interface Subject extends Entity {
  name: string;
  color: string;
  teacher: string;
  room: string;
  /** Building / campus as a Place (for travel). `null` = no travel. */
  placeId: string | null;
  archived: boolean;
}

export const subjects = defineCollection<Subject>('subjects', {
  label: 'collections.subjects',
  schema: v.object({
    ...entityFields,
    name: v.string(),
    color: v.string(),
    teacher: v.string(),
    room: v.string(),
    placeId: v.nullable(v.string()),
    archived: v.boolean(),
  }),
});

export interface LessonType extends Entity {
  name: string;
  /** Short label for compact views: "Лек", "Пр". */
  short: string;
  color: string;
  order: number;
}

export const lessonTypes = defineCollection<LessonType>('lessonTypes', {
  label: 'collections.lessonTypes',
  schema: v.object({ ...entityFields, name: v.string(), short: v.string(), color: v.string(), order: v.number() }),
});

export const sortedLessonTypes = computed(() => [...lessonTypes.all.value].sort((a, b) => a.order - b.order));
export const activeSubjects = computed(() =>
  subjects.all.value.filter((s) => !s.archived).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
);

// ── Bell schedule ──────────────────────────────────────────────────────────

export interface BellSlot {
  n: number;
  start: Minutes;
  end: Minutes;
}

export const bells = defineDoc<{ slots: BellSlot[] }>('bells', { slots: [] });

/** Builds slots from the first start, one duration and an individual break after each pair. */
export function buildBells(first: Minutes, count: number, length: Minutes, breaks: readonly Minutes[]): BellSlot[] {
  const slots: BellSlot[] = [];
  let start = first;
  for (let n = 1; n <= count && start + length <= 1440; n++) {
    slots.push({ n, start, end: start + length });
    start += length + (breaks[n - 1] ?? 10);
  }
  return slots;
}


// ── Timetables (one per semester) ──────────────────────────────────────────

export interface LessonData {
  subjectId: string;
  typeId: string | null;
  start: Minutes;
  end: Minutes;
  /** Bell number the time came from; `null` = custom time. */
  bell: number | null;
  /** Overrides of the subject defaults; `null` = inherit. */
  room: string | null;
  placeId: string | null;
  /** Online: no travel. */
  online: boolean;
}

export interface TemplateLesson extends LessonData {
  id: string;
}

export interface Timetable extends Entity {
  name: string;
  startDate: ISODate;
  /** Inclusive; `null` = open-ended. */
  endDate: ISODate | null;
  cycle: Cycle<TemplateLesson[]>;
}

const lessonEntries = {
  subjectId: v.string(),
  typeId: v.nullable(v.string()),
  start: minutes,
  end: minutes,
  bell: v.nullable(v.number()),
  room: v.nullable(v.string()),
  placeId: v.nullable(v.string()),
  online: v.boolean(),
};

export const timetables = defineCollection<Timetable>('timetables', {
  label: 'collections.timetables',
  schema: v.object({
    ...entityFields,
    name: v.string(),
    startDate: isoDate,
    endDate: v.nullable(isoDate),
    cycle: cycleSchema(v.array(v.object({ id: v.string(), ...lessonEntries }))),
  }),
});

export const lessonOverrides = defineOverrides<LessonData>('lessonOverrides', 'collections.lessonOverrides', lessonEntries);

export const sortedTimetables = computed(() =>
  [...timetables.all.value].sort((a, b) => compareDates(b.startDate, a.startDate)),
);

/** The timetable in effect on a date: the latest one that has started and not ended. */
export function timetableFor(date: ISODate): Timetable | undefined {
  return sortedTimetables.value.find(
    (t) => compareDates(t.startDate, date) <= 0 && (t.endDate === null || compareDates(date, t.endDate) <= 0),
  );
}

// ── Resolved lessons for a date ────────────────────────────────────────────

export interface Lesson {
  key: string;
  date: ISODate;
  data: LessonData;
  subject: Subject | undefined;
  type: LessonType | undefined;
  /** Effective place (`null` = no travel). */
  placeId: string | null;
  room: string;
  origin: 'template' | 'added';
  modified: boolean;
}

function toLesson(date: ISODate, key: string, data: LessonData, origin: Lesson['origin'], modified: boolean): Lesson {
  const subject = subjects.get(data.subjectId);
  return {
    key,
    date,
    data,
    subject,
    type: data.typeId ? lessonTypes.get(data.typeId) : undefined,
    placeId: data.online ? null : (data.placeId ?? subject?.placeId ?? null),
    room: data.room ?? subject?.room ?? '',
    origin,
    modified,
  };
}

function templateFor(date: ISODate): { key: string; data: LessonData }[] {
  const tt = timetableFor(date);
  if (!tt) return [];
  return cycleDay(tt.cycle, date).map(({ id, ...data }) => ({ key: id, data }));
}

export function lessonsFor(date: ISODate): Lesson[] {
  return resolveDay(templateFor(date), lessonOverrides.forDate(date))
    .map((p) => toLesson(date, p.key, p.data, p.origin, p.modified))
    .sort((a, b) => a.data.start - b.data.start);
}

/** Template lessons cancelled on this date (shown greyed out so they can be restored). */
export function cancelledLessonsFor(date: ISODate): Lesson[] {
  return templateFor(date)
    .filter((t) => lessonOverrides.isCancelled(date, t.key))
    .map((t) => toLesson(date, t.key, t.data, 'template', false));
}

export function findLesson(date: ISODate, key: string): Lesson | undefined {
  return lessonsFor(date).find((l) => l.key === key) ?? cancelledLessonsFor(date).find((l) => l.key === key);
}

/** Next lesson of a subject strictly after `after` (within ~2 months). */
export function nextLessonOf(subjectId: string, after: ISODate): Lesson | undefined {
  for (let i = 1; i <= 62; i++) {
    const d = addDays(after, i);
    const found = lessonsFor(d).find((l) => l.data.subjectId === subjectId);
    if (found) return found;
  }
  return undefined;
}
