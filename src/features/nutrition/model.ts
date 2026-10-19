import * as v from 'valibot';
import { computed } from '@preact/signals';
import { cycleDay, type Cycle } from '@/core/cycle';
import { compareDates, diffDays, type ISODate, type Minutes } from '@/core/date';
import { entityFields, isoDate, minutes } from '@/core/store/schema';
import { defineCollection, defineDoc, type Entity } from '@/core/store/store';

// ── Macros ─────────────────────────────────────────────────────────────────

export interface Macros {
  kcal: number;
  p: number;
  f: number;
  c: number;
}

export const ZERO: Macros = { kcal: 0, p: 0, f: 0, c: 0 };

export function addMacros(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, p: a.p + b.p, f: a.f + b.f, c: a.c + b.c };
}

export function scaleMacros(m: Macros, k: number): Macros {
  return { kcal: m.kcal * k, p: m.p * k, f: m.f * k, c: m.c * k };
}

const macrosSchema = v.object({ kcal: v.number(), p: v.number(), f: v.number(), c: v.number() });

// ── Foods: products and dishes in one base ─────────────────────────────────

export type FoodUnit = 'g' | 'ml';

export interface Portion {
  id: string;
  name: string;
  grams: number;
}

export interface Ingredient {
  foodId: string;
  grams: number;
}

export interface Food extends Entity {
  name: string;
  kind: 'product' | 'dish';
  unit: FoodUnit;
  /** Per 100 g/ml. For dishes it is derived from ingredients (see per100). */
  per100: Macros;
  portions: Portion[];
  /** Dishes only: products and their raw weight. */
  ingredients: Ingredient[];
  /** Dishes only: weight after cooking; `null` = sum of ingredients. */
  cookedWeight: number | null;
  archived: boolean;
}

export const foods = defineCollection<Food>('foods', {
  label: 'collections.foods',
  schema: v.object({
    ...entityFields,
    name: v.string(),
    kind: v.picklist(['product', 'dish']),
    unit: v.picklist(['g', 'ml']),
    per100: macrosSchema,
    portions: v.array(v.object({ id: v.string(), name: v.string(), grams: v.number() })),
    ingredients: v.array(v.object({ foodId: v.string(), grams: v.number() })),
    cookedWeight: v.nullable(v.number()),
    archived: v.boolean(),
  }),
});

export const activeFoods = computed(() =>
  foods.all.value.filter((f) => !f.archived).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
);

/** Macros per 100 g of a food; dishes are computed from their ingredients. */
export function per100(food: Food): Macros {
  if (food.kind === 'product') return food.per100;
  let total = ZERO;
  let weight = 0;
  for (const ing of food.ingredients) {
    const product = foods.get(ing.foodId);
    if (!product || product.kind !== 'product') continue;
    total = addMacros(total, scaleMacros(product.per100, ing.grams / 100));
    weight += ing.grams;
  }
  const finalWeight = food.cookedWeight ?? weight;
  return finalWeight > 0 ? scaleMacros(total, 100 / finalWeight) : ZERO;
}

export function macrosOf(foodId: string, grams: number): Macros {
  const food = foods.get(foodId);
  return food ? scaleMacros(per100(food), grams / 100) : ZERO;
}

// ── Meal plan (cycle of days, each with meals) ─────────────────────────────

export interface PlanItem {
  id: string;
  foodId: string;
  grams: number;
}

export interface PlannedMeal {
  id: string;
  name: string;
  time: Minutes | null;
  items: PlanItem[];
}

export const mealPlan = defineDoc<{ cycle: Cycle<PlannedMeal[]> | null }>('mealPlan', { cycle: null });

export function plannedMeals(date: ISODate): PlannedMeal[] {
  const cycle = mealPlan.value.value.cycle;
  if (!cycle) return [];
  return [...cycleDay(cycle, date)].sort((a, b) => (a.time ?? 1441) - (b.time ?? 1441));
}

// ── Food log (what was actually eaten) ─────────────────────────────────────

export interface FoodLogEntry extends Entity {
  date: ISODate;
  /** Planned meal this belongs to; `null` = outside the plan. */
  mealId: string | null;
  /** Planned item this records; `null` = extra food. */
  plannedItemId: string | null;
  foodId: string;
  grams: number;
  status: 'eaten' | 'skipped';
}

export const foodLog = defineCollection<FoodLogEntry>('foodLog', {
  label: 'collections.foodLog',
  schema: v.object({
    ...entityFields,
    date: isoDate,
    mealId: v.nullable(v.string()),
    plannedItemId: v.nullable(v.string()),
    foodId: v.string(),
    grams: v.number(),
    status: v.picklist(['eaten', 'skipped']),
  }),
});

const logByDate = computed(() => {
  const map = new Map<string, FoodLogEntry[]>();
  for (const e of foodLog.all.value) {
    let list = map.get(e.date);
    if (!list) map.set(e.date, (list = []));
    list.push(e);
  }
  return map;
});

export function logOn(date: ISODate): readonly FoodLogEntry[] {
  return logByDate.value.get(date) ?? [];
}

// ── Day view: plan vs fact ─────────────────────────────────────────────────

export type ItemState = 'pending' | 'eaten' | 'skipped';

export interface DayItem {
  item: PlanItem;
  entry: FoodLogEntry | undefined;
  state: ItemState;
  /** Grams actually eaten (planned grams while pending). */
  grams: number;
}

export interface DayMeal {
  meal: PlannedMeal;
  items: DayItem[];
  state: 'pending' | 'partial' | 'done';
}

export interface NutritionDay {
  meals: DayMeal[];
  extras: FoodLogEntry[];
  plan: Macros;
  fact: Macros;
}

export function nutritionDay(date: ISODate): NutritionDay {
  const log = logOn(date);
  const byItem = new Map(log.filter((e) => e.plannedItemId).map((e) => [e.plannedItemId as string, e]));
  let plan = ZERO;
  let fact = ZERO;
  const meals = plannedMeals(date).map((meal): DayMeal => {
    const items = meal.items.map((item): DayItem => {
      plan = addMacros(plan, macrosOf(item.foodId, item.grams));
      const entry = byItem.get(item.id);
      const state: ItemState = entry ? entry.status : 'pending';
      const grams = entry && entry.status === 'eaten' ? entry.grams : item.grams;
      if (state === 'eaten') fact = addMacros(fact, macrosOf(entry?.foodId ?? item.foodId, grams));
      return { item, entry, state, grams };
    });
    const settled = items.filter((i) => i.state !== 'pending').length;
    return { meal, items, state: settled === 0 ? 'pending' : settled === items.length ? 'done' : 'partial' };
  });
  const extras = log.filter((e) => !e.plannedItemId && e.status === 'eaten');
  for (const e of extras) fact = addMacros(fact, macrosOf(e.foodId, e.grams));
  return { meals, extras, plan, fact };
}

// ── Intake: supplements, medications, anything without macros ─────────────

export type IntakeKind = 'supplement' | 'medication' | 'other';
export type DoseUnit = 'g' | 'mg' | 'mcg' | 'iu' | 'caps' | 'tab' | 'ml' | 'pcs';
export const DOSE_UNITS: readonly DoseUnit[] = ['g', 'mg', 'mcg', 'iu', 'caps', 'tab', 'ml', 'pcs'];

export interface IntakeItem extends Entity {
  name: string;
  kind: IntakeKind;
  dose: number;
  unit: DoseUnit;
  /** Times of day; each is a separate check. */
  times: Minutes[];
  /** 1 = every day, 2 = every other day… counted from `anchor`. */
  everyDays: number;
  anchor: ISODate;
  archived: boolean;
}

export const intakeItems = defineCollection<IntakeItem>('intakeItems', {
  label: 'collections.intakeItems',
  schema: v.object({
    ...entityFields,
    name: v.string(),
    kind: v.picklist(['supplement', 'medication', 'other']),
    dose: v.number(),
    unit: v.picklist(['g', 'mg', 'mcg', 'iu', 'caps', 'tab', 'ml', 'pcs']),
    times: v.array(minutes),
    everyDays: v.pipe(v.number(), v.minValue(1)),
    anchor: isoDate,
    archived: v.boolean(),
  }),
});

export interface IntakeLogEntry extends Entity {
  date: ISODate;
  itemId: string;
  /** Index into `times`; `null` = extra, unscheduled intake. */
  slot: number | null;
}

export const intakeLog = defineCollection<IntakeLogEntry>('intakeLog', {
  label: 'collections.intakeLog',
  schema: v.object({ ...entityFields, date: isoDate, itemId: v.string(), slot: v.nullable(v.number()) }),
});

export function isIntakeDay(item: IntakeItem, date: ISODate): boolean {
  const d = diffDays(item.anchor, date);
  return d >= 0 && d % item.everyDays === 0;
}

export interface IntakeSlot {
  item: IntakeItem;
  slot: number;
  time: Minutes;
  entry: IntakeLogEntry | undefined;
}

export function intakeSlots(date: ISODate): IntakeSlot[] {
  const log = intakeLog.all.value.filter((e) => e.date === date);
  return intakeItems.all.value
    .filter((i) => !i.archived && isIntakeDay(i, date))
    .flatMap((item) => item.times.map((time, slot) => ({ item, slot, time, entry: log.find((e) => e.itemId === item.id && e.slot === slot) })))
    .sort((a, b) => a.time - b.time);
}

// ── Water ──────────────────────────────────────────────────────────────────

export interface WaterEntry extends Entity {
  date: ISODate;
  ml: number;
}

export const waterLog = defineCollection<WaterEntry>('waterLog', {
  label: 'collections.waterLog',
  schema: v.object({ ...entityFields, date: isoDate, ml: v.number() }),
});

export function waterOn(date: ISODate): number {
  return waterLog.all.value.filter((w) => w.date === date).reduce((s, w) => s + w.ml, 0);
}

// ── Body ───────────────────────────────────────────────────────────────────

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'high' | 'athlete';
export type GoalType = 'lose' | 'maintain' | 'gain';

export interface BodyProfile {
  heightCm: number | null;
  birthYear: number | null;
  sex: Sex;
  bodyFatPct: number | null;
  activity: Activity;
  goal: GoalType;
  /** Target change in % of body weight per week (positive number). */
  ratePct: number;
  /** Manual override of computed targets. */
  manual: Macros | null;
  /** Manual water target (ml); `null` = computed. */
  waterMl: number | null;
}

export const bodyProfile = defineDoc<BodyProfile>('bodyProfile', {
  heightCm: null,
  birthYear: null,
  sex: 'male',
  bodyFatPct: null,
  activity: 'moderate',
  goal: 'maintain',
  ratePct: 0.5,
  manual: null,
  waterMl: null,
});

export interface WeightEntry extends Entity {
  date: ISODate;
  kg: number;
}

export const weightLog = defineCollection<WeightEntry>('weightLog', {
  label: 'collections.weightLog',
  schema: v.object({ ...entityFields, date: isoDate, kg: v.number() }),
});

export const weightsByDate = computed(() => [...weightLog.all.value].sort((a, b) => compareDates(a.date, b.date)));

export function setWeight(date: ISODate, kg: number): void {
  const existing = weightLog.all.value.find((w) => w.date === date);
  if (existing) weightLog.update(existing.id, { kg });
  else weightLog.add({ date, kg });
}
