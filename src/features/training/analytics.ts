import { diffDays, startOfWeek, type ISODate } from '@/core/date';
import type { Exercise, Measure, SetLog, WorkoutSession } from './model';

/**
 * Objective strength metrics.
 *  e1RM (Epley): w·(1 + r/30). With RPE, reps in reserve are added: r + (10 − RPE),
 *  so 100×5 @RPE8 counts like a 7-rep max effort.
 *  Trend: least-squares fit of ln(metric) over time → % change per week.
 *  Category index: each exercise normalised to its own baseline (median of the
 *  first 3 sessions = 100), weekly median across the category's exercises.
 */
export function e1rm(weight: number, reps: number, rpe: number | null = null): number {
  const effective = reps + (rpe !== null ? Math.max(0, 10 - rpe) : 0);
  if (weight <= 0 || reps <= 0) return 0;
  return effective <= 1 ? weight : weight * (1 + effective / 30);
}

/** The per-session number we track: e1RM for weights, best reps / seconds otherwise. */
export function setMetric(set: Pick<SetLog, 'weight' | 'reps' | 'rpe'>, measure: Measure): number {
  return measure === 'weight' ? e1rm(set.weight, set.reps, set.rpe) : set.reps;
}

export interface Point {
  date: ISODate;
  value: number;
}

export interface SessionPoint extends Point {
  volume: number;
  sets: number;
  session: WorkoutSession;
}

export function exerciseSeries(exercise: Pick<Exercise, 'id' | 'measure'>, list: readonly WorkoutSession[]): SessionPoint[] {
  const out: SessionPoint[] = [];
  for (const s of list) {
    if (!s.finished) continue;
    const sets = s.exercises.filter((x) => x.exerciseId === exercise.id).flatMap((x) => x.sets.filter((set) => set.done && set.reps > 0));
    if (sets.length === 0) continue;
    out.push({
      date: s.date,
      value: Math.max(...sets.map((set) => setMetric(set, exercise.measure))),
      volume: sets.reduce((sum, set) => sum + set.weight * set.reps, 0),
      sets: sets.length,
      session: s,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface Trend {
  /** % change per week. */
  weeklyPct: number;
  /** Fitted value at a date. */
  at: (date: ISODate) => number;
  n: number;
}

/** Log-linear least squares; needs ≥3 points spanning ≥7 days. */
export function trend(points: readonly Point[]): Trend | null {
  const pts = points.filter((p) => p.value > 0);
  if (pts.length < 3) return null;
  const first = pts[0]!.date;
  const xs = pts.map((p) => diffDays(first, p.date));
  if (xs[xs.length - 1]! - xs[0]! < 7) return null;
  const ys = pts.map((p) => Math.log(p.value));
  const n = pts.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return {
    weeklyPct: (Math.exp(slope * 7) - 1) * 100,
    at: (date) => Math.exp(intercept + slope * diffDays(first, date)),
    n,
  };
}

export type ProgressStatus = 'growth' | 'stable' | 'plateau' | 'new';

/** Plateau: the last 3 sessions didn't beat the best result before them. */
export function progressStatus(series: readonly Point[], t: Trend | null): ProgressStatus {
  if (series.length < 4) return 'new';
  const before = Math.max(...series.slice(0, -3).map((p) => p.value));
  const recent = Math.max(...series.slice(-3).map((p) => p.value));
  if (recent <= before) return 'plateau';
  return t && t.weeklyPct > 0.25 ? 'growth' : 'stable';
}

export const STATUS_LABELS: Record<ProgressStatus, string> = {
  growth: 'Рост',
  stable: 'Стабильно',
  plateau: 'Плато',
  new: 'Мало данных',
};

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Weekly strength index of a group of exercises (baseline = 100). */
export function categoryIndex(exerciseList: readonly Pick<Exercise, 'id' | 'measure'>[], list: readonly WorkoutSession[]): Point[] {
  const byWeek = new Map<string, number[]>();
  for (const ex of exerciseList) {
    const series = exerciseSeries(ex, list);
    if (series.length === 0) continue;
    const base = median(series.slice(0, 3).map((p) => p.value));
    if (base <= 0) continue;
    const bestPerWeek = new Map<string, number>();
    for (const p of series) {
      const w = startOfWeek(p.date);
      bestPerWeek.set(w, Math.max(bestPerWeek.get(w) ?? 0, (p.value / base) * 100));
    }
    for (const [w, v] of bestPerWeek) {
      let arr = byWeek.get(w);
      if (!arr) byWeek.set(w, (arr = []));
      arr.push(v);
    }
  }
  return [...byWeek.entries()]
    .map(([date, values]) => ({ date: date as ISODate, value: median(values) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface WeekLoad {
  week: ISODate;
  sets: number;
  volume: number;
}

/** Completed sets and tonnage per week for exercises matching `include`. */
export function weeklyLoad(list: readonly WorkoutSession[], include: (exerciseId: string) => boolean): WeekLoad[] {
  const map = new Map<string, WeekLoad>();
  for (const s of list) {
    if (!s.finished) continue;
    const week = startOfWeek(s.date);
    for (const ex of s.exercises) {
      if (!include(ex.exerciseId)) continue;
      for (const set of ex.sets) {
        if (!set.done || set.reps <= 0) continue;
        let w = map.get(week);
        if (!w) map.set(week, (w = { week, sets: 0, volume: 0 }));
        w.sets++;
        w.volume += set.weight * set.reps;
      }
    }
  }
  return [...map.values()].sort((a, b) => (a.week < b.week ? -1 : 1));
}
