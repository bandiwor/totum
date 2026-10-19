import { compareDates, nowMinutes, today, type ISODate, type Minutes } from '@/core/date';
import { newId } from '@/core/id';
import { setMetric } from './analytics';
import {
  exercises,
  formatKg,
  sessions,
  templates,
  type PlannedExercise,
  type SessionExercise,
  type SetLog,
  type Target,
  type WorkoutSession,
  type WorkoutTemplate,
} from './model';
import { nextTarget } from './progression';

function setsFromTarget(t: Target): SetLog[] {
  return Array.from({ length: t.sets }, () => ({ weight: t.weight, reps: t.repGoal, rpe: null, done: false }));
}

export function sessionExerciseFrom(planned: PlannedExercise): SessionExercise {
  const { id, exerciseId, ...target } = planned;
  return { id: newId(), exerciseId, plannedId: id, target, sets: setsFromTarget(target) };
}

export function freeSessionExercise(exerciseId: string): SessionExercise {
  const prev = previousSets(exerciseId, null);
  const last = prev?.[prev.length - 1];
  return {
    id: newId(),
    exerciseId,
    plannedId: null,
    target: null,
    sets: Array.from({ length: Math.max(1, prev?.length ?? 3) }, () => ({ weight: last?.weight ?? 0, reps: last?.reps ?? 10, rpe: null, done: false })),
  };
}

/** Creates (or returns the existing) session for a planned slot or an ad-hoc template workout. */
export function startSession(opts: {
  template: WorkoutTemplate | undefined;
  date?: ISODate;
  slotKey?: string | null;
  start?: Minutes;
  end?: Minutes | null;
  title?: string;
}): WorkoutSession {
  const date = opts.date ?? today();
  if (opts.slotKey) {
    const existing = sessions.all.value.find((s) => s.date === date && s.slotKey === opts.slotKey);
    if (existing) return existing;
  }
  return sessions.add({
    date,
    slotKey: opts.slotKey ?? null,
    templateId: opts.template?.id ?? null,
    title: opts.title ?? opts.template?.name ?? 'Тренировка',
    start: opts.start ?? nowMinutes(),
    end: opts.end ?? null,
    finished: false,
    progressionApplied: false,
    wellbeing: null,
    note: '',
    exercises: opts.template?.exercises.map(sessionExerciseFrom) ?? [],
  });
}

/** Done sets of the most recent finished session before `session` that has this exercise. */
export function previousSets(exerciseId: string, session: WorkoutSession | null): SetLog[] | null {
  const candidates = sessions.all.value
    .filter((s) => s.finished && s.id !== session?.id && (!session || compareDates(s.date, session.date) < 0 || (s.date === session.date && s.start < session.start)))
    .sort((a, b) => compareDates(b.date, a.date) || b.start - a.start);
  for (const s of candidates) {
    const sets = s.exercises.filter((x) => x.exerciseId === exerciseId).flatMap((x) => x.sets.filter((set) => set.done));
    if (sets.length) return sets;
  }
  return null;
}

export interface FinishSummary {
  changes: { name: string; text: string }[];
  records: string[];
}

function describeChange(from: Target, to: Target, unit: string): string | null {
  if (to.weight > from.weight) return `${formatKg(from.weight)} → ${formatKg(to.weight)} кг`;
  if (to.repGoal > from.repGoal) return `цель ${from.repGoal} → ${to.repGoal}${unit}`;
  return null;
}

export function finishSession(session: WorkoutSession, wellbeing: number | null, note: string): FinishSummary {
  const summary: FinishSummary = { changes: [], records: [] };
  const template = session.templateId ? templates.get(session.templateId) : undefined;

  if (!session.progressionApplied && template) {
    const updated = template.exercises.map((planned) => {
      const logged = session.exercises.find((x) => x.plannedId === planned.id);
      const exercise = exercises.get(planned.exerciseId);
      if (!logged || !exercise) return planned;
      const { id, exerciseId, ...current } = planned;
      const { target, change } = nextTarget(current, logged.sets, exercise.measure);
      if (change === 'weight' || change === 'reps') {
        const text = describeChange(current, target, exercise.measure === 'time' ? ' с' : '');
        if (text) summary.changes.push({ name: exercise.name, text });
      }
      return { ...target, id, exerciseId };
    });
    templates.update(template.id, { exercises: updated });
  }

  // Personal records vs every earlier finished session.
  for (const ex of session.exercises) {
    const exercise = exercises.get(ex.exerciseId);
    if (!exercise) continue;
    const done = ex.sets.filter((s) => s.done && s.reps > 0);
    if (!done.length) continue;
    const best = Math.max(...done.map((s) => setMetric(s, exercise.measure)));
    const before = sessions.all.value
      .filter((s) => s.finished && s.id !== session.id)
      .flatMap((s) => s.exercises.filter((x) => x.exerciseId === ex.exerciseId).flatMap((x) => x.sets.filter((set) => set.done && set.reps > 0)))
      .map((s) => setMetric(s, exercise.measure));
    if (before.length && best > Math.max(...before)) summary.records.push(exercise.name);
  }

  const end = session.end ?? (session.date === today() ? Math.max(session.start + 5, nowMinutes()) : session.start + (template?.duration ?? 60));
  sessions.update(session.id, { finished: true, progressionApplied: true, wellbeing, note, end: Math.min(1440, end) });
  return summary;
}

export function updateSet(session: WorkoutSession, exId: string, index: number, patch: Partial<SetLog>): void {
  sessions.update(session.id, {
    exercises: session.exercises.map((x) =>
      x.id === exId ? { ...x, sets: x.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)) } : x,
    ),
  });
}

export function updateExercises(session: WorkoutSession, fn: (list: SessionExercise[]) => SessionExercise[]): void {
  sessions.update(session.id, { exercises: fn(session.exercises) });
}
