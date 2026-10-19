import * as v from 'valibot';
import { computed } from '@preact/signals';
import { cycleDay, type Cycle } from '@/core/cycle';
import type { ISODate, Minutes } from '@/core/date';
import { resolveDay } from '@/core/plan';
import { defineOverrides } from '@/core/store/overrides';
import { cycleSchema, entityFields, minutes } from '@/core/store/schema';
import { defineCollection, type Entity } from '@/core/store/store';

export interface ShiftData {
  jobId: string;
  start: Minutes;
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

const shiftEntries = { jobId: v.string(), start: minutes, end: minutes };

export const jobs = defineCollection<Job>('jobs', {
  label: 'Работа',
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

export const shiftOverrides = defineOverrides<ShiftData>('shiftOverrides', 'Изменения смен', shiftEntries);

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

export const PAY_LABELS: Record<PayType, string> = { hour: 'в час', shift: 'за смену', month: 'в месяц' };
