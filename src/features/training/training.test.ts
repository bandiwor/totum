import { describe, expect, it } from 'vitest';
import { addDays, toISODate } from '@/core/date';
import { categoryIndex, e1rm, exerciseSeries, progressStatus, trend } from './analytics';
import type { Target, WorkoutSession } from './model';
import { nextTarget } from './progression';

const base: Target = { sets: 3, repMin: 8, repMax: 12, repGoal: 8, weight: 80, rpe: null, rule: 'double', step: 2.5 };
const sets = (w: number, ...reps: number[]) => reps.map((r) => ({ weight: w, reps: r, rpe: null, done: true }));

describe('progression', () => {
  it('double: reps climb inside the range', () => {
    const r = nextTarget(base, sets(80, 10, 9, 9), 'weight');
    expect(r).toMatchObject({ change: 'reps', target: { weight: 80, repGoal: 10 } });
  });
  it('double: top of range → weight up, reps reset', () => {
    const r = nextTarget({ ...base, repGoal: 12 }, sets(80, 12, 12, 12), 'weight');
    expect(r).toMatchObject({ change: 'weight', target: { weight: 82.5, repGoal: 8 } });
  });
  it('never goes down on a bad day', () => {
    const r = nextTarget({ ...base, repGoal: 10 }, sets(80, 7, 6, 6), 'weight');
    expect(r).toMatchObject({ change: 'hold', target: { weight: 80, repGoal: 10 } });
    expect(nextTarget(base, sets(75, 12, 12, 12), 'weight').change).toBe('hold');
  });
  it('adopts a heavier weight when the goal was met', () => {
    const r = nextTarget(base, sets(85, 8, 8, 8), 'weight');
    expect(r).toMatchObject({ change: 'weight', target: { weight: 85, repGoal: 9 } });
  });
  it('respects target RPE', () => {
    const hard = [12, 12, 12].map((reps) => ({ weight: 80, reps, rpe: 10, done: true }));
    const r = nextTarget({ ...base, repGoal: 12, rpe: 9 }, hard, 'weight');
    expect(r.change).toBe('hold');
  });
  it('linear and reps rules', () => {
    expect(nextTarget({ ...base, rule: 'linear', repGoal: 5 }, sets(100, 5, 5, 5), 'weight').target.weight).toBe(102.5);
    expect(nextTarget({ ...base, rule: 'reps', repGoal: 10, weight: 0 }, sets(0, 11, 10, 10), 'reps').target.repGoal).toBe(11);
    expect(nextTarget({ ...base, repGoal: 60, step: 5 }, sets(0, 60, 62, 61), 'time').target.repGoal).toBe(65);
  });
  it('ignores sets not marked done', () => {
    const s = [...sets(80, 12, 12), { weight: 80, reps: 12, rpe: null, done: false }];
    expect(nextTarget({ ...base, repGoal: 12 }, s, 'weight').change).toBe('hold');
  });
});

describe('analytics', () => {
  it('e1RM with RPE', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 5, 8)).toBeCloseTo(100 * (1 + 7 / 30));
  });

  const start = toISODate('2026-09-01');
  const mk = (i: number, weight: number, exerciseId = 'bench'): WorkoutSession => ({
    id: `s${i}`, createdAt: 0, updatedAt: 0, date: addDays(start, i * 7), slotKey: null, templateId: null, title: '',
    start: 0, end: null, finished: true, progressionApplied: true, wellbeing: null, note: '',
    exercises: [{ id: 'x', exerciseId, plannedId: null, target: null, sets: sets(weight, 5, 5) }],
  });

  it('weekly trend is ~+2%/week for 2% weekly growth', () => {
    const list = [0, 1, 2, 3, 4, 5].map((i) => mk(i, 100 * 1.02 ** i));
    const series = exerciseSeries({ id: 'bench', measure: 'weight' }, list);
    expect(trend(series)?.weeklyPct).toBeCloseTo(2, 5);
    expect(progressStatus(series, trend(series))).toBe('growth');
  });

  it('detects a plateau', () => {
    const list = [100, 105, 110, 108, 110, 109].map((w, i) => mk(i, w));
    const series = exerciseSeries({ id: 'bench', measure: 'weight' }, list);
    expect(progressStatus(series, trend(series))).toBe('plateau');
  });

  it('category index normalises exercises of different scale', () => {
    const list = [0, 1, 2, 3].flatMap((i) => [mk(i, 100 * 1.05 ** i, 'bench'), mk(i, 20 * 1.05 ** i, 'fly')]);
    const idx = categoryIndex([{ id: 'bench', measure: 'weight' }, { id: 'fly', measure: 'weight' }], list);
    expect(idx.map((p) => Math.round(p.value))).toEqual([95, 100, 105, 110]);
  });
});
