import { addDays, compareDates, diffDays, type ISODate } from '@/core/date';
import type { Activity, BodyProfile, Macros } from './model';

/**
 * Daily targets from the body profile and real data.
 *
 *  Weight trend: exponential moving average (α = 0.1 per day) — filters water swings.
 *  BMR: Mifflin–St Jeor; Katch–McArdle when body fat % is known.
 *  Expenditure: BMR × activity at first; once there are ≥14 logged days in the
 *    last 28 with weigh-ins, adaptive: mean intake − weight slope·7700 kcal/kg
 *    (clamped to ±25 % of the formula, to survive bad logging).
 *  Goal: ± rate % of body weight per week (≈7700 kcal per kg), never below BMR.
 *  Protein: 1.6 g/kg (Morton et al. 2018 — gains plateau around 1.6, CI up to 2.2),
 *    rising with deficit depth to 2.4 g/kg (Helms et al. 2014: higher needs when
 *    lean and in deficit). With BMI > 30 the reference is the weight at BMI 25.
 *  Fat: ≥ 0.6 g/kg; 27 % of energy at maintenance, down to 20 % in a deep deficit.
 *  Carbs: the remainder.
 *  Water: 35 ml/kg.
 */

export const ACTIVITY_FACTORS: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  athlete: 1.9,
};

const KCAL_PER_KG = 7700;
const ALPHA = 0.1;

export interface TrendPoint {
  date: ISODate;
  raw: number;
  trend: number;
}

/** EMA over irregular daily data: a gap of n days applies n smoothing steps. */
export function weightTrend(weights: readonly { date: ISODate; kg: number }[]): TrendPoint[] {
  const out: TrendPoint[] = [];
  let ema: number | null = null;
  let prev: ISODate | null = null;
  for (const w of [...weights].sort((a, b) => compareDates(a.date, b.date))) {
    if (ema === null || prev === null) ema = w.kg;
    else {
      const gap = Math.max(1, diffDays(prev, w.date));
      ema += (1 - (1 - ALPHA) ** gap) * (w.kg - ema);
    }
    prev = w.date;
    out.push({ date: w.date, raw: w.kg, trend: ema });
  }
  return out;
}

/**
 * Least-squares slope (kg per day) of the raw weigh-ins. Regression already
 * averages out noise; the EMA would lag at the start of a series and understate the rate.
 */
export function slopePerDay(points: readonly TrendPoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0]!.date;
  const xs = points.map((p) => diffDays(first, p.date));
  const ys = points.map((p) => p.raw);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

export function bmr(p: { weight: number; heightCm: number | null; age: number | null; sex: BodyProfile['sex']; bodyFatPct: number | null }): number | null {
  if (p.bodyFatPct !== null) return 370 + 21.6 * p.weight * (1 - p.bodyFatPct / 100);
  if (p.heightCm === null || p.age === null) return null;
  return 10 * p.weight + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

export interface TargetsInput {
  profile: BodyProfile;
  weights: readonly { date: ISODate; kg: number }[];
  /** Calories eaten per day, only for days that were logged. */
  intake: readonly { date: ISODate; kcal: number }[];
  today: ISODate;
}

export type Missing = 'weight' | 'height' | 'age';

export interface Targets extends Macros {
  water: number;
  weight: number;
  bmr: number;
  tdee: number;
  tdeeSource: 'formula' | 'adaptive';
  /** kg per week from the trend (last 28 days), if known. */
  weeklyChange: number | null;
  deficitPct: number;
  proteinPerKg: number;
  manual: boolean;
}

export type TargetsResult = { ok: true; targets: Targets } | { ok: false; missing: Missing[] };

export function computeTargets({ profile, weights, intake, today }: TargetsInput): TargetsResult {
  const trend = weightTrend(weights);
  const last = trend[trend.length - 1];
  const age = profile.birthYear ? Number(today.slice(0, 4)) - profile.birthYear : null;
  const missing: Missing[] = [];
  if (!last) missing.push('weight');
  if (profile.bodyFatPct === null) {
    if (profile.heightCm === null) missing.push('height');
    if (age === null) missing.push('age');
  }
  if (!last || missing.length) return { ok: false, missing };

  const weight = last.trend;
  const base = bmr({ weight, heightCm: profile.heightCm, age, sex: profile.sex, bodyFatPct: profile.bodyFatPct }) ?? 0;
  const formula = base * ACTIVITY_FACTORS[profile.activity];

  const from = addDays(today, -28);
  const window = trend.filter((p) => compareDates(p.date, from) >= 0);
  const slope = slopePerDay(window);
  const spanOk = window.length >= 2 && diffDays(window[0]!.date, window[window.length - 1]!.date) >= 10;
  const logged = intake.filter((d) => d.kcal > 0 && compareDates(d.date, from) >= 0 && compareDates(d.date, today) < 0);

  let tdee = formula;
  let source: Targets['tdeeSource'] = 'formula';
  if (logged.length >= 14 && slope !== null && spanOk) {
    const mean = logged.reduce((s, d) => s + d.kcal, 0) / logged.length;
    tdee = Math.min(formula * 1.25, Math.max(formula * 0.75, mean - slope * KCAL_PER_KG));
    source = 'adaptive';
  }

  const dailyDelta = ((profile.ratePct / 100) * weight * KCAL_PER_KG) / 7;
  let kcal = profile.goal === 'lose' ? tdee - dailyDelta : profile.goal === 'gain' ? tdee + dailyDelta : tdee;
  kcal = Math.max(kcal, base);
  const deficitPct = Math.max(0, ((tdee - kcal) / tdee) * 100);
  const depth = Math.min(1, deficitPct / 25);

  const heightM = profile.heightCm ? profile.heightCm / 100 : null;
  const refWeight = heightM && weight / heightM ** 2 > 30 ? 25 * heightM ** 2 : weight;
  const proteinPerKg = 1.6 + 0.8 * depth;
  const p = proteinPerKg * refWeight;
  const fatShare = 0.27 - 0.07 * depth;
  const f = Math.max(0.6 * weight, (fatShare * kcal) / 9);
  const c = Math.max(0, (kcal - 4 * p - 9 * f) / 4);

  const computed: Targets = {
    kcal,
    p,
    f,
    c,
    water: profile.waterMl ?? Math.round((weight * 35) / 50) * 50,
    weight,
    bmr: base,
    tdee,
    tdeeSource: source,
    weeklyChange: slope !== null && spanOk ? slope * 7 : null,
    deficitPct,
    proteinPerKg,
    manual: false,
  };
  if (profile.manual) return { ok: true, targets: { ...computed, ...profile.manual, manual: true } };
  return { ok: true, targets: computed };
}
