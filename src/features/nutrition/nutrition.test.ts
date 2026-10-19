import { describe, expect, it } from 'vitest';
import { addDays, toISODate } from '@/core/date';
import type { BodyProfile } from './model';
import { bmr, computeTargets, weightTrend } from './targets';

const today = toISODate('2026-10-19');
const profile: BodyProfile = {
  heightCm: 180, birthYear: 2006, sex: 'male', bodyFatPct: null, activity: 'moderate',
  goal: 'maintain', ratePct: 0.5, manual: null, waterMl: null,
};
const flat = (kg: number, days = 30) => Array.from({ length: days }, (_, i) => ({ date: addDays(today, -days + i), kg }));

describe('targets', () => {
  it('Mifflin–St Jeor and Katch–McArdle', () => {
    expect(bmr({ weight: 80, heightCm: 180, age: 20, sex: 'male', bodyFatPct: null })).toBe(800 + 1125 - 100 + 5);
    expect(bmr({ weight: 80, heightCm: null, age: null, sex: 'male', bodyFatPct: 15 })).toBeCloseTo(370 + 21.6 * 68);
  });

  it('reports missing data', () => {
    expect(computeTargets({ profile: { ...profile, heightCm: null }, weights: [], intake: [], today })).toEqual({ ok: false, missing: ['weight', 'height'] });
  });

  it('protein rises and fat share drops with deficit depth', () => {
    const run = (goal: BodyProfile['goal'], ratePct: number) => {
      const r = computeTargets({ profile: { ...profile, goal, ratePct }, weights: flat(80), intake: [], today });
      if (!r.ok) throw new Error('no targets');
      return r.targets;
    };
    const keep = run('maintain', 0.5);
    const cut = run('lose', 1);
    expect(keep.proteinPerKg).toBeCloseTo(1.6);
    expect(cut.proteinPerKg).toBeGreaterThan(keep.proteinPerKg);
    expect(cut.kcal).toBeLessThan(keep.kcal);
    expect(cut.f).toBeGreaterThanOrEqual(0.6 * 80 - 1e-9);
    // Energy adds up.
    expect(4 * keep.p + 9 * keep.f + 4 * keep.c).toBeCloseTo(keep.kcal);
  });

  it('switches to adaptive expenditure with enough logged data', () => {
    // Losing 0.5 kg/week while eating 2200 → expenditure ≈ 2200 + 0.5·7700/7 = 2750.
    const weights = Array.from({ length: 28 }, (_, i) => ({ date: addDays(today, -28 + i), kg: 82 - (0.5 / 7) * i }));
    const intake = weights.map((w) => ({ date: w.date, kcal: 2200 }));
    const r = computeTargets({ profile, weights, intake, today });
    if (!r.ok) throw new Error('no targets');
    expect(r.targets.tdeeSource).toBe('adaptive');
    expect(r.targets.tdee).toBeGreaterThan(2650);
    expect(r.targets.tdee).toBeLessThan(2800);
    expect(r.targets.weeklyChange).toBeCloseTo(-0.5, 1);
  });

  it('EMA smooths a one-day spike', () => {
    const pts = weightTrend([...flat(80, 10), { date: today, kg: 82 }]);
    expect(pts[pts.length - 1]!.trend).toBeCloseTo(80.2, 5);
  });
});

describe('plan vs fact', async () => {
  const { foods, foodLog, mealPlan, nutritionDay, per100 } = await import('./model');
  const oats = foods.add({ name: 'Овсянка', kind: 'product', unit: 'g', per100: { kcal: 370, p: 13, f: 6, c: 60 }, portions: [], ingredients: [], cookedWeight: null, archived: false });
  const milk = foods.add({ name: 'Молоко', kind: 'product', unit: 'ml', per100: { kcal: 60, p: 3, f: 3.2, c: 4.7 }, portions: [], ingredients: [], cookedWeight: null, archived: false });

  it('computes dish macros per 100 g, respecting cooked weight', () => {
    const porridge = foods.add({
      name: 'Каша', kind: 'dish', unit: 'g', per100: { kcal: 0, p: 0, f: 0, c: 0 }, portions: [],
      ingredients: [{ foodId: oats.id, grams: 60 }, { foodId: milk.id, grams: 200 }], cookedWeight: null, archived: false,
    });
    expect(per100(porridge).kcal).toBeCloseTo(((370 * 0.6 + 60 * 2) / 260) * 100);
    foods.update(porridge.id, { cookedWeight: 300 });
    expect(per100(foods.get(porridge.id)!).kcal).toBeCloseTo(((370 * 0.6 + 60 * 2) / 300) * 100);
  });

  it('tracks plan, eaten, adjusted, skipped and extra food', () => {
    mealPlan.set({
      cycle: {
        anchor: today, weekAligned: false,
        days: [[{ id: 'b', name: 'Завтрак', time: 480, items: [{ id: 'i1', foodId: oats.id, grams: 100 }, { id: 'i2', foodId: milk.id, grams: 200 }] }]],
      },
    });
    let day = nutritionDay(today);
    expect(day.plan.kcal).toBeCloseTo(370 + 120);
    expect(day.fact.kcal).toBe(0);
    expect(day.meals[0]?.state).toBe('pending');

    foodLog.add({ date: today, mealId: 'b', plannedItemId: 'i1', foodId: oats.id, grams: 50, status: 'eaten' });
    foodLog.add({ date: today, mealId: 'b', plannedItemId: 'i2', foodId: milk.id, grams: 200, status: 'skipped' });
    foodLog.add({ date: today, mealId: null, plannedItemId: null, foodId: milk.id, grams: 100, status: 'eaten' });
    day = nutritionDay(today);
    expect(day.meals[0]?.state).toBe('done');
    expect(day.fact.kcal).toBeCloseTo(185 + 60);
    expect(day.extras).toHaveLength(1);
  });
});
