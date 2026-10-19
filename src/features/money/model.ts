import * as v from 'valibot';
import { computed } from '@preact/signals';
import type { ISODate } from '@/core/date';
import { entityFields, isoDate } from '@/core/store/schema';
import { defineCollection, defineDoc, type Entity } from '@/core/store/store';

export type FlowType = 'expense' | 'income';

export interface MoneyCategory extends Entity {
  name: string;
  type: FlowType;
  color: string;
  order: number;
}

export const moneyCategories = defineCollection<MoneyCategory>('moneyCategories', {
  label: 'collections.moneyCategories',
  schema: v.object({ ...entityFields, name: v.string(), type: v.picklist(['expense', 'income']), color: v.string(), order: v.number() }),
});

export const sortedMoneyCategories = computed(() => [...moneyCategories.all.value].sort((a, b) => a.order - b.order));

/**
 * One money movement. `spreadMonths` > 1 spreads an expense over months in the
 * analytics (a 3-month course counts a third per month) while the balance pays
 * it in full on the date.
 */
export interface Transaction extends Entity {
  date: ISODate;
  type: FlowType;
  amount: number;
  categoryId: string | null;
  note: string;
  spreadMonths: number;
  /** Planned (future or not yet paid) vs done. */
  status: 'planned' | 'done';
  /** Occurrence of a recurring payment this settles. */
  recurringId: string | null;
  /** Income received from a job. */
  jobId: string | null;
}

export const transactions = defineCollection<Transaction>('transactions', {
  label: 'collections.transactions',
  schema: v.object({
    ...entityFields,
    date: isoDate,
    type: v.picklist(['expense', 'income']),
    amount: v.pipe(v.number(), v.minValue(0)),
    categoryId: v.nullable(v.string()),
    note: v.string(),
    spreadMonths: v.pipe(v.number(), v.integer(), v.minValue(1)),
    status: v.picklist(['planned', 'done']),
    recurringId: v.nullable(v.string()),
    jobId: v.nullable(v.string()),
  }),
});

export type Period = 'month' | 'week' | 'days';

export interface Recurring extends Entity {
  name: string;
  type: FlowType;
  amount: number;
  categoryId: string | null;
  period: Period;
  /** Every N months / weeks / days. */
  every: number;
  anchor: ISODate;
  endDate: ISODate | null;
  active: boolean;
}

export const recurring = defineCollection<Recurring>('recurring', {
  label: 'collections.recurring',
  schema: v.object({
    ...entityFields,
    name: v.string(),
    type: v.picklist(['expense', 'income']),
    amount: v.number(),
    categoryId: v.nullable(v.string()),
    period: v.picklist(['month', 'week', 'days']),
    every: v.pipe(v.number(), v.integer(), v.minValue(1)),
    anchor: isoDate,
    endDate: v.nullable(isoDate),
    active: v.boolean(),
  }),
});

export interface Goal extends Entity {
  name: string;
  target: number;
  deadline: ISODate | null;
  /** Money put aside for this goal. */
  contributions: { date: ISODate; amount: number }[];
  archived: boolean;
}

export const goals = defineCollection<Goal>('goals', {
  label: 'collections.goals',
  schema: v.object({
    ...entityFields,
    name: v.string(),
    target: v.number(),
    deadline: v.nullable(isoDate),
    contributions: v.array(v.object({ date: isoDate, amount: v.number() })),
    archived: v.boolean(),
  }),
});

export const goalSaved = (g: Goal): number => g.contributions.reduce((s, c) => s + c.amount, 0);

/** `openingBalance` + every done transaction = current balance. */
export const moneySettings = defineDoc<{ openingBalance: number; currency: string; seeded: boolean }>('money', {
  openingBalance: 0,
  currency: '₽',
  seeded: false,
});
