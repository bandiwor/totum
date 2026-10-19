import { computed } from '@preact/signals';
import { today, type ISODate } from '@/core/date';
import { fx } from '@/core/fx';
import { t } from '@/core/i18n';
import {
  bodyProfile,
  foodLog,
  foods,
  intakeLog,
  logOn,
  macrosOf,
  nutritionDay,
  waterLog,
  waterOn,
  weightsByDate,
  type DayItem,
  type DayMeal,
  type IntakeSlot,
  type Macros,
  type PlannedMeal,
} from './model';
import { computeTargets, type TargetsResult } from './targets';

// ── Formatting ─────────────────────────────────────────────────────────────

export const fmtKcal = (n: number): string => String(Math.round(n));
export const fmtG = (n: number): string => String(Math.round(n));
export const fmtKg = (n: number): string => n.toFixed(1).replace(/\.0$/, '');

/** "250 г" or "250 мл" depending on the food's unit. */
export function fmtAmount(foodId: string, amount: number): string {
  const unit = foods.get(foodId)?.unit ?? 'g';
  return unit === 'ml' ? t('nutrition.ml', { n: fmtG(amount) }) : t('nutrition.grams', { n: fmtG(amount) });
}

export function macroLine(m: Macros): string {
  return t('nutrition.macroLine', {
    p: t('nutrition.macroValue', { short: t('nutrition.pShort'), value: fmtG(m.p) }),
    f: t('nutrition.macroValue', { short: t('nutrition.fShort'), value: fmtG(m.f) }),
    c: t('nutrition.macroValue', { short: t('nutrition.cShort'), value: fmtG(m.c) }),
  });
}

// ── Targets (reactive) ─────────────────────────────────────────────────────

/** Calories per logged day (for adaptive expenditure). */
const dailyIntake = computed(() => {
  const map = new Map<string, number>();
  for (const e of foodLog.all.value) {
    if (e.status !== 'eaten') continue;
    map.set(e.date, (map.get(e.date) ?? 0) + macrosOf(e.foodId, e.grams).kcal);
  }
  return [...map.entries()].map(([date, kcal]) => ({ date: date as ISODate, kcal }));
});

export const targets = computed<TargetsResult>(() =>
  computeTargets({ profile: bodyProfile.value.value, weights: weightsByDate.value, intake: dailyIntake.value, today: today() }),
);

// ── Food log ───────────────────────────────────────────────────────────────

function entryFor(date: ISODate, itemId: string) {
  return logOn(date).find((e) => e.plannedItemId === itemId);
}

export function setItem(date: ISODate, meal: PlannedMeal, item: DayItem['item'], status: 'eaten' | 'skipped', grams = item.grams): void {
  const existing = entryFor(date, item.id);
  const data = { date, mealId: meal.id, plannedItemId: item.id, foodId: item.foodId, grams, status };
  if (existing) foodLog.update(existing.id, data);
  else foodLog.add(data);
  celebrateIfDone(date);
}

export function clearItem(date: ISODate, itemId: string): void {
  const existing = entryFor(date, itemId);
  if (existing) foodLog.remove(existing.id);
}

/** "Ate everything as planned" for the pending items of a meal. */
export function eatMeal(date: ISODate, day: DayMeal): void {
  for (const i of day.items) if (i.state === 'pending') setItem(date, day.meal, i.item, 'eaten');
}

export function addExtra(date: ISODate, foodId: string, grams: number, mealId: string | null): void {
  foodLog.add({ date, mealId, plannedItemId: null, foodId, grams, status: 'eaten' });
  celebrateIfDone(date);
}

function celebrateIfDone(date: ISODate): void {
  const r = targets.value;
  if (!r.ok) return;
  const fact = nutritionDay(date).fact;
  if (Math.abs(fact.kcal - r.targets.kcal) / r.targets.kcal < 0.05 && fact.p >= r.targets.p * 0.95) fx('nutrition-goal');
}

// ── Intake & water ─────────────────────────────────────────────────────────

export function toggleIntake(date: ISODate, slot: IntakeSlot): void {
  if (slot.entry) intakeLog.remove(slot.entry.id);
  else intakeLog.add({ date, itemId: slot.item.id, slot: slot.slot });
}

export function addWater(date: ISODate, ml: number): void {
  waterLog.add({ date, ml });
  const r = targets.value;
  const goal = r.ok ? r.targets.water : null;
  if (goal && waterOn(date) >= goal && waterOn(date) - ml < goal) fx('water-goal');
}

export function undoWater(date: ISODate): void {
  const last = [...waterLog.all.value].filter((w) => w.date === date).sort((a, b) => b.createdAt - a.createdAt)[0];
  if (last) waterLog.remove(last.id);
}

export function waterTarget(): number {
  const r = targets.value;
  return r.ok ? r.targets.water : (bodyProfile.value.value.waterMl ?? 2000);
}
