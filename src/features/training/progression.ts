import type { Measure, SetLog, Target } from './model';

export type ProgressionChange = 'weight' | 'reps' | 'hold' | 'none';

export interface ProgressionResult {
  target: Target;
  change: ProgressionChange;
}

/**
 * Adapts the plan to what was actually done. The plan only goes up or holds —
 * never down (a bad day doesn't lower tomorrow's target).
 *
 *  double — reps climb to the top of the range, then weight +step and reps back to the bottom.
 *  linear — goal reps hit on every set → weight +step.
 *  reps   — goal reps hit → goal +1 (bodyweight, fixed weight).
 *  time / reps-measured exercises — goal hit → +1 rep / +step seconds.
 * Heavier-than-planned sets that hit the goal raise the planned weight.
 * Sets with RPE above the target don't count as a "clean" success.
 */
export function nextTarget(t: Target, sets: readonly Pick<SetLog, 'weight' | 'reps' | 'rpe' | 'done'>[], measure: Measure): ProgressionResult {
  if (t.rule === 'none') return { target: t, change: 'none' };
  const done = sets.filter((s) => s.done && s.reps > 0);
  const rpeOk = (s: { rpe: number | null }): boolean => t.rpe === null || s.rpe === null || s.rpe <= t.rpe;
  const hold: ProgressionResult = { target: t, change: 'hold' };

  if (measure !== 'weight') {
    const top = [...done].sort((a, b) => b.reps - a.reps).slice(0, t.sets);
    if (top.length < t.sets) return hold;
    const minReps = Math.min(...top.map((s) => s.reps));
    if (minReps < t.repGoal || !top.every(rpeOk)) return hold;
    const inc = measure === 'time' ? Math.max(1, t.step) : 1;
    return { target: { ...t, repGoal: Math.max(t.repGoal + inc, minReps + (measure === 'time' ? 0 : 1)) }, change: 'reps' };
  }

  // Working sets: at or above the planned weight; the heaviest `sets` of them are judged.
  const working = done
    .filter((s) => s.weight >= t.weight)
    .sort((a, b) => b.weight - a.weight || b.reps - a.reps)
    .slice(0, t.sets);
  if (working.length < t.sets) return hold;

  const weight = Math.min(...working.map((s) => s.weight));
  const minReps = Math.min(...working.map((s) => s.reps));
  const clean = working.every(rpeOk);
  const heavier = weight > t.weight;
  // At a heavier weight the bar for "goal met" is the bottom of the range.
  const goal = heavier ? Math.min(t.repGoal, t.repMin) : t.repGoal;
  if (minReps < goal) return hold;

  switch (t.rule) {
    case 'double': {
      if (minReps >= t.repMax && clean) {
        return { target: { ...t, weight: weight + t.step, repGoal: t.repMin }, change: 'weight' };
      }
      const repGoal = Math.min(t.repMax, Math.max(heavier ? t.repMin : t.repGoal, minReps + (clean ? 1 : 0)));
      if (!heavier && repGoal === t.repGoal) return hold;
      return { target: { ...t, weight, repGoal }, change: heavier ? 'weight' : 'reps' };
    }
    case 'linear':
      if (!clean) return heavier ? { target: { ...t, weight }, change: 'weight' } : hold;
      return { target: { ...t, weight: weight + t.step }, change: 'weight' };
    case 'reps':
      if (!clean) return hold;
      return { target: { ...t, weight, repGoal: Math.max(t.repGoal + 1, minReps + 1) }, change: 'reps' };
  }
}
