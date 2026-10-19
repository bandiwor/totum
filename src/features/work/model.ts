import * as v from 'valibot';
import { computed } from '@preact/signals';
import { cycleDay, type Cycle } from '@/core/cycle';
import { formatTime, type ISODate, type Minutes } from '@/core/date';
import { t } from '@/core/i18n';
import { resolveDay } from '@/core/plan';
import { defineOverrides } from '@/core/store/overrides';
import { cycleSchema, entityFields, minutes } from '@/core/store/schema';
import { defineCollection, type Entity } from '@/core/store/store';

export interface ShiftData {
  jobId: string;
  start: Minutes;
  /** Past 1440 = ends the next day (night shift): 22:00–06:00 is 1320–1800. */
  end: Minutes;
}

export interface TemplateShift extends ShiftData {
  id: string;
}

export type PayType = 'hour' | 'shift' | 'month';

export interface Job extends Entity {
  name: string;
  color: string;
  placeId: string | null;
  payType: PayType;
  /** Rate per hour / shift / month (in the money section's currency). */
  rate: number;
  archived: boolean;
  /** Regular shifts; `null` = only one-off shifts. */
  cycle: Cycle<TemplateShift[]> | null;
}

const shiftEntries = { jobId: v.string(), start: minutes, end: v.pipe(v.number(), v.minValue(0), v.maxValue(2 * 1440)) };

export const jobs = defineCollection<Job>('jobs', {
  label: 'collections.jobs',
  schema: v.object({
    ...entityFields,
    name: v.string(),
    color: v.string(),
    placeId: v.nullable(v.string()),
    payType: v.picklist(['hour', 'shift', 'month']),
    rate: v.number(),
    archived: v.boolean(),
    cycle: v.nullable(cycleSchema(v.array(v.object({ id: v.string(), ...shiftEntries })))),
  }),
});

export const shiftOverrides = defineOverrides<ShiftData>('shiftOverrides', 'collections.shiftOverrides', shiftEntries);

export const activeJobs = computed(() => jobs.all.value.filter((j) => !j.archived));

export interface Shift {
  key: string;
  date: ISODate;
  data: ShiftData;
  job: Job | undefined;
  origin: 'template' | 'added';
  modified: boolean;
}

export function shiftsFor(date: ISODate): Shift[] {
  const template = activeJobs.value.flatMap((job) =>
    job.cycle ? cycleDay(job.cycle, date).map(({ id, ...data }) => ({ key: id, data })) : [],
  );
  return resolveDay(template, shiftOverrides.forDate(date))
    .map((p) => ({ key: p.key, date, data: p.data, job: jobs.get(p.data.jobId), origin: p.origin, modified: p.modified }))
    .filter((s) => s.job && !s.job.archived)
    .sort((a, b) => a.data.start - b.data.start);
}

export const PAY_TYPES: readonly PayType[] = ['hour', 'shift', 'month'];

/** "22:00–06:00 (+1)" for shifts that end the next day. */
export function shiftRange(start: Minutes, end: Minutes): string {
  const range = t('time.range', { from: formatTime(start), to: formatTime(end % 1440) });
  return end > 1440 ? t('work.nextDayRange', { range }) : range;
}
