import * as v from 'valibot';
import { computed } from '@preact/signals';
import { cycleDay, type Cycle } from '@/core/cycle';
import { compareDates, type ISODate, type Minutes } from '@/core/date';
import { resolveDay } from '@/core/plan';
import { defineOverrides } from '@/core/store/overrides';
import { entityFields, isoDate, minutes } from '@/core/store/schema';
import { defineCollection, defineDoc, type Entity } from '@/core/store/store';
import { t } from '@/core/i18n';

// ── Library ────────────────────────────────────────────────────────────────

export interface ExerciseCategory extends Entity {
  name: string;
  color: string;
  order: number;
}

export const categories = defineCollection<ExerciseCategory>('exerciseCategories', {
  label: 'collections.exerciseCategories',
  schema: v.object({ ...entityFields, name: v.string(), color: v.string(), order: v.number() }),
});

export const sortedCategories = computed(() => [...categories.all.value].sort((a, b) => a.order - b.order));

/** How a set is measured: weight × reps, reps only (bodyweight), or time (seconds in `reps`). */
export type Measure = 'weight' | 'reps' | 'time';

export interface Exercise extends Entity {
  name: string;
  categoryId: string | null;
  measure: Measure;
  /** Weight increment (kg) for weight exercises, seconds for timed ones. */
  step: number;
  note: string;
  archived: boolean;
}

export const exercises = defineCollection<Exercise>('exercises', {
  label: 'collections.exercises',
  schema: v.object({
    ...entityFields,
    name: v.string(),
    categoryId: v.nullable(v.string()),
    measure: v.picklist(['weight', 'reps', 'time']),
    step: v.number(),
    note: v.string(),
    archived: v.boolean(),
  }),
});

export const activeExercises = computed(() =>
  exercises.all.value.filter((e) => !e.archived).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
);

// ── Targets & templates ────────────────────────────────────────────────────

export type ProgressionRule = 'double' | 'linear' | 'reps' | 'none';

/** What the plan asks for. Updated automatically after each workout (never downwards). */
export interface Target {
  sets: number;
  repMin: number;
  repMax: number;
  /** Current rep goal inside the range (or seconds for timed exercises). */
  repGoal: number;
  weight: number;
  /** Target RPE; sets above it don't count as "easy enough" to progress. */
  rpe: number | null;
  rule: ProgressionRule;
  step: number;
}

export interface PlannedExercise extends Target {
  id: string;
  exerciseId: string;
}

export interface WorkoutTemplate extends Entity {
  name: string;
  color: string;
  /** Typical duration, used when the workout is added without explicit times. */
  duration: Minutes;
  exercises: PlannedExercise[];
}

const targetEntries = {
  sets: v.number(),
  repMin: v.number(),
  repMax: v.number(),
  repGoal: v.number(),
  weight: v.number(),
  rpe: v.nullable(v.number()),
  rule: v.picklist(['double', 'linear', 'reps', 'none']),
  step: v.number(),
};

export const templates = defineCollection<WorkoutTemplate>('workoutTemplates', {
  label: 'collections.workoutTemplates',
  schema: v.object({
    ...entityFields,
    name: v.string(),
    color: v.string(),
    duration: v.number(),
    exercises: v.array(v.object({ id: v.string(), exerciseId: v.string(), ...targetEntries })),
  }),
});

// ── Program (cycle of workout slots) ───────────────────────────────────────

export interface SlotData {
  templateId: string;
  start: Minutes;
  end: Minutes;
  placeId: string | null;
}

export interface TemplateSlot extends SlotData {
  id: string;
}

export const program = defineDoc<{ cycle: Cycle<TemplateSlot[]> | null }>('trainingProgram', { cycle: null });

const slotEntries = { templateId: v.string(), start: minutes, end: minutes, placeId: v.nullable(v.string()) };
export const workoutOverrides = defineOverrides<SlotData>('workoutOverrides', 'collections.workoutOverrides', slotEntries);

export interface PlannedWorkout {
  key: string;
  date: ISODate;
  data: SlotData;
  template: WorkoutTemplate | undefined;
  origin: 'template' | 'added';
  modified: boolean;
}

function slotTemplate(date: ISODate): { key: string; data: SlotData }[] {
  const cycle = program.value.value.cycle;
  if (!cycle) return [];
  return cycleDay(cycle, date).map(({ id, ...data }) => ({ key: id, data }));
}

const toPlanned = (date: ISODate, key: string, data: SlotData, origin: PlannedWorkout['origin'], modified: boolean): PlannedWorkout => ({
  key,
  date,
  data,
  template: templates.get(data.templateId),
  origin,
  modified,
});

export function plannedWorkouts(date: ISODate): PlannedWorkout[] {
  return resolveDay(slotTemplate(date), workoutOverrides.forDate(date))
    .map((p) => toPlanned(date, p.key, p.data, p.origin, p.modified))
    .sort((a, b) => a.data.start - b.data.start);
}

export function cancelledWorkouts(date: ISODate): PlannedWorkout[] {
  return slotTemplate(date)
    .filter((s) => workoutOverrides.isCancelled(date, s.key))
    .map((s) => toPlanned(date, s.key, s.data, 'template', false));
}

// ── Sessions (the log) ─────────────────────────────────────────────────────

export interface SetLog {
  weight: number;
  /** Reps, or seconds for timed exercises. */
  reps: number;
  rpe: number | null;
  done: boolean;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  /** The template entry this came from (progression is written back to it). */
  plannedId: string | null;
  /** Plan at the time the workout started. */
  target: Target | null;
  sets: SetLog[];
}

export interface WorkoutSession extends Entity {
  date: ISODate;
  /** Planned slot this session fulfils; `null` = ad-hoc workout. */
  slotKey: string | null;
  templateId: string | null;
  title: string;
  start: Minutes;
  end: Minutes | null;
  finished: boolean;
  /** Progression already written back to the template. */
  progressionApplied: boolean;
  /** 1..5 */
  wellbeing: number | null;
  note: string;
  exercises: SessionExercise[];
}

export const sessions = defineCollection<WorkoutSession>('workoutSessions', {
  label: 'collections.workoutSessions',
  schema: v.object({
    ...entityFields,
    date: isoDate,
    slotKey: v.nullable(v.string()),
    templateId: v.nullable(v.string()),
    title: v.string(),
    start: minutes,
    end: v.nullable(minutes),
    finished: v.boolean(),
    progressionApplied: v.boolean(),
    wellbeing: v.nullable(v.number()),
    note: v.string(),
    exercises: v.array(
      v.object({
        id: v.string(),
        exerciseId: v.string(),
        plannedId: v.nullable(v.string()),
        target: v.nullable(v.object(targetEntries)),
        sets: v.array(v.object({ weight: v.number(), reps: v.number(), rpe: v.nullable(v.number()), done: v.boolean() })),
      }),
    ),
  }),
});

/** Newest first. */
export const sessionsByDate = computed(() =>
  [...sessions.all.value].sort((a, b) => compareDates(b.date, a.date) || b.start - a.start),
);

export const activeSession = computed(() => sessionsByDate.value.find((s) => !s.finished));

export function sessionsOn(date: ISODate): WorkoutSession[] {
  return sessions.all.value.filter((s) => s.date === date).sort((a, b) => a.start - b.start);
}

export function sessionForSlot(date: ISODate, slotKey: string): WorkoutSession | undefined {
  return sessions.all.value.find((s) => s.date === date && s.slotKey === slotKey);
}

// ── Labels ─────────────────────────────────────────────────────────────────

export const RULES: readonly ProgressionRule[] = ['double', 'linear', 'reps', 'none'];
export const MEASURES: readonly Measure[] = ['weight', 'reps', 'time'];
export const WELLBEING = [1, 2, 3, 4, 5] as const;

export const ruleLabel = (r: ProgressionRule): string => t(`training.rule.${r}`);
export const measureLabel = (m: Measure): string => t(`training.measure.${m}`);
export function wellbeingLabel(n: number): string {
  const level = Math.min(5, Math.max(1, Math.round(n))) as (typeof WELLBEING)[number];
  return t(`training.wellbeingLevels.l${level}`);
}

export function formatKg(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, '')}`;
}

/** "80×8", "12 повт", "45 с". */
export function formatSet(set: Pick<SetLog, 'weight' | 'reps'>, measure: Measure): string {
  if (measure === 'time') return t('training.fmtTime', { n: set.reps });
  if (measure === 'reps') return set.weight > 0 ? t('training.fmtRepsPlus', { weight: formatKg(set.weight), reps: set.reps }) : t('training.fmtReps', { n: set.reps });
  return t('training.fmtWeight', { weight: formatKg(set.weight), reps: set.reps });
}

/** "3×8–12 · 80 кг · RPE 8". */
export function formatTarget(target: Target, measure: Measure): string {
  const ranged = target.rule === 'double' && target.repMin !== target.repMax;
  const range = ranged ? t('time.range', { from: target.repMin, to: target.repMax }) : `${target.repGoal}`;
  const parts = [`${target.sets}×${range}${measure === 'time' ? ` ${t('units.sec')}` : ''}`];
  if (ranged) parts.push(t('training.fmtGoal', { n: target.repGoal }));
  if (measure === 'weight' || target.weight > 0) parts.push(t('training.fmtKg', { n: formatKg(target.weight) }));
  if (target.rpe !== null) parts.push(t('training.fmtRpe', { n: target.rpe }));
  return parts.join(' · ');
}
