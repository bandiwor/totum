import * as v from 'valibot';
import { computed } from '@preact/signals';
import { compareDates, today, type ISODate, type Minutes } from '@/core/date';
import { entityFields, isoDate, minutes } from '@/core/store/schema';
import { defineCollection, type Entity } from '@/core/store/store';

/** Tasks and homework are one entity: homework is a task linked to a subject (and maybe a lesson). */
export interface Task extends Entity {
  title: string;
  note: string;
  date: ISODate | null;
  time: Minutes | null;
  done: boolean;
  doneAt: number | null;
  subjectId: string | null;
  /** The specific lesson this homework is for. */
  lesson: { date: ISODate; key: string } | null;
}

export const tasks = defineCollection<Task>('tasks', {
  label: 'Задачи',
  schema: v.object({
    ...entityFields,
    title: v.string(),
    note: v.string(),
    date: v.nullable(isoDate),
    time: v.nullable(minutes),
    done: v.boolean(),
    doneAt: v.nullable(v.number()),
    subjectId: v.nullable(v.string()),
    lesson: v.nullable(v.object({ date: isoDate, key: v.string() })),
  }),
});

export function byDue(a: Task, b: Task): number {
  if (a.date !== b.date) return a.date === null ? 1 : b.date === null ? -1 : compareDates(a.date, b.date);
  if (a.time !== b.time) return a.time === null ? 1 : b.time === null ? -1 : a.time - b.time;
  return a.createdAt - b.createdAt;
}

export const openTasks = computed(() => tasks.all.value.filter((t) => !t.done).sort(byDue));

export function tasksOn(date: ISODate): Task[] {
  return tasks.all.value.filter((t) => t.date === date).sort((a, b) => Number(a.done) - Number(b.done) || byDue(a, b));
}

export function overdueTasks(asOf: ISODate = today()): Task[] {
  return openTasks.value.filter((t) => t.date !== null && compareDates(t.date, asOf) < 0);
}

export function homeworkFor(date: ISODate, lessonKey: string): Task[] {
  return tasks.all.value.filter((t) => t.lesson?.date === date && t.lesson.key === lessonKey);
}
