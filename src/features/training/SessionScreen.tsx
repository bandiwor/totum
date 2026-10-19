import { useState } from 'preact/hooks';
import { formatRelativeDay, formatTime } from '@/core/date';
import { fx } from '@/core/fx';
import { haptic } from '@/core/haptics';
import type { RouteProps } from '@/core/registry';
import { goBack, navigate } from '@/core/router';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ChoiceChips,
  colorVar,
  confirm,
  EmptyState,
  Field,
  Form,
  IconButton,
  List,
  ListRow,
  NumberStepper,
  openSheet,
  Page,
  ProgressBar,
  Section,
  SheetActions,
  TextArea,
  toast,
} from '@/ui';
import { finishSession, freeSessionExercise, previousSets, updateExercises, updateSet, type FinishSummary } from './actions';
import { openExercisePicker } from './ExerciseForm';
import {
  categories,
  exercises,
  formatKg,
  formatSet,
  formatTarget,
  sessions,
  WELLBEING,
  wellbeingLabel,
  type Exercise,
  type SessionExercise,
  type SetLog,
  type WorkoutSession,
} from './model';
import { t } from '@/core/i18n';

const RPE_OPTIONS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => ({ value: v, label: String(v) }));

function SetEditor({
  set,
  exercise,
  onSave,
  onDelete,
  close,
}: {
  set: SetLog;
  exercise: Exercise;
  onSave: (s: SetLog) => void;
  onDelete: () => void;
  close: () => void;
}) {
  const [d, setD] = useState(set);
  const isTime = exercise.measure === 'time';
  return (
    <Form>
      {exercise.measure !== 'time' && (
        <NumberStepper
          label={exercise.measure === 'reps' ? t('training.extraWeight') : t('training.weight')}
          value={d.weight}
          step={exercise.step || 2.5}
          precision={2}
          unit={t('units.kg')}
          onChange={(weight) => setD({ ...d, weight })}
        />
      )}
      <NumberStepper
        label={isTime ? t('training.time') : t('training.reps')}
        value={d.reps}
        step={isTime ? 5 : 1}
        unit={isTime ? t('units.sec') : t('units.reps')}
        onChange={(reps) => setD({ ...d, reps })}
      />
      <Field label={t('training.rpeLabel')}>
        <ChoiceChips allowNone options={RPE_OPTIONS} value={d.rpe} onChange={(rpe) => setD({ ...d, rpe })} />
      </Field>
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          icon="check"
          feedback={false}
          onClick={(e) => {
            haptic('success');
            fx('set-done', e.currentTarget);
            onSave({ ...d, done: true });
            close();
          }}
        >
          {t('training.countSet')}
        </Button>
        {d.done && (
          <Button
            block
            onClick={() => {
              onSave({ ...d, done: false });
              close();
            }}
          >
            {t('training.uncheck')}
          </Button>
        )}
        <Button
          variant="danger"
          block
          icon="trash"
          onClick={() => {
            onDelete();
            close();
          }}
        >
          {t('training.deleteSet')}
        </Button>
      </SheetActions>
    </Form>
  );
}

function ExerciseCard({ session, item }: { session: WorkoutSession; item: SessionExercise }) {
  const exercise = exercises.get(item.exerciseId);
  if (!exercise) return null;
  const category = exercise.categoryId ? categories.get(exercise.categoryId) : undefined;
  const prev = previousSets(item.exerciseId, session);

  const editSet = (index: number): void => {
    const set = item.sets[index];
    if (!set) return;
    void openSheet(
      (close) => (
        <SetEditor
          set={set}
          exercise={exercise}
          onSave={(s) => updateSet(session, item.id, index, s)}
          onDelete={() => updateExercises(session, (list) => list.map((x) => (x.id === item.id ? { ...x, sets: x.sets.filter((_, i) => i !== index) } : x)))}
          close={close}
        />
      ),
      { title: t('training.setTitle', { name: exercise.name, n: index + 1 }) },
    );
  };

  const addSet = (): void => {
    const last = item.sets[item.sets.length - 1];
    const next: SetLog = { weight: last?.weight ?? 0, reps: last?.reps ?? 10, rpe: null, done: false };
    updateExercises(session, (list) => list.map((x) => (x.id === item.id ? { ...x, sets: [...x.sets, next] } : x)));
    haptic('light');
  };

  const remove = async (): Promise<void> => {
    if (await confirm({ title: t('training.removeExercise', { name: exercise.name }), confirmLabel: t('common.remove'), danger: true })) {
      updateExercises(session, (list) => list.filter((x) => x.id !== item.id));
    }
  };

  return (
    <Card padded={false} class="ex-card">
      <div class="ex-card__head">
        <span class="color-dot" style={{ background: colorVar(category?.color ?? 'c8') }} />
        <button type="button" class="ex-card__title" onClick={() => navigate(`health/exercise/${exercise.id}`)}>
          {exercise.name}
        </button>
        <IconButton icon="trash" label={t('common.remove')} onClick={() => void remove()} />
      </div>
      {item.target && <p class="ex-card__meta">{t('training.planLine', { target: formatTarget(item.target, exercise.measure) })}</p>}
      {prev && <p class="ex-card__meta">{t('training.lastTime', { sets: prev.map((s) => formatSet(s, exercise.measure)).join(' · ') })}</p>}
      <div class="ex-card__sets">
        {item.sets.map((s, i) => (
          <div key={i} class={s.done ? 'set-row is-done' : 'set-row'}>
            <span class="set-row__n num">{i + 1}</span>
            <button type="button" class="set-row__value num" onClick={() => editSet(i)}>
              {exercise.measure === 'weight' && (
                <>
                  <b>{formatKg(s.weight)}</b> {t('units.kg')} × <b>{s.reps}</b>
                </>
              )}
              {exercise.measure === 'reps' && (
                <>
                  <b>{s.reps}</b> {t('units.reps')}
                  {s.weight > 0 ? ` · +${t('training.fmtKg', { n: formatKg(s.weight) })}` : ''}
                </>
              )}
              {exercise.measure === 'time' && (
                <>
                  <b>{s.reps}</b> {t('units.sec')}
                </>
              )}
              {s.rpe !== null && <Badge>RPE {s.rpe}</Badge>}
            </button>
            <Checkbox
              checked={s.done}
              label={t('training.setN', { n: i + 1 })}
              celebrate="set-done"
              {...(category ? { color: colorVar(category.color) } : {})}
              onChange={(done) => updateSet(session, item.id, i, { done })}
            />
          </div>
        ))}
      </div>
      <button type="button" class="ex-card__add" onClick={addSet}>
        {t('training.addSet')}
      </button>
    </Card>
  );
}

function SummaryView({ summary, close }: { summary: FinishSummary; close: () => void }) {
  return (
    <>
      {summary.records.length > 0 && (
        <Section title={t('training.records')}>
          <List>
            {summary.records.map((r) => (
              <ListRow key={r} icon="sparkles" title={r} subtitle={t('training.recordHint')} />
            ))}
          </List>
        </Section>
      )}
      <Section title={t('training.nextPlan')}>
        {summary.changes.length ? (
          <List>
            {summary.changes.map((c) => (
              <ListRow key={c.name} icon="zap" title={c.name} subtitle={c.text} />
            ))}
          </List>
        ) : (
          <p class="sheet-note">{t('training.noChanges')}</p>
        )}
      </Section>
      <SheetActions>
        <Button variant="primary" size="lg" block onClick={close}>
          {t('common.great')}
        </Button>
      </SheetActions>
    </>
  );
}

function FinishForm({ session, close }: { session: WorkoutSession; close: () => void }) {
  const [wellbeing, setWellbeing] = useState<number | null>(session.wellbeing);
  const [note, setNote] = useState(session.note);
  return (
    <Form>
      <Field label={t('training.wellbeing')}>
        <ChoiceChips options={WELLBEING.map((value) => ({ value, label: wellbeingLabel(value) }))} value={wellbeing} onChange={setWellbeing} />
      </Field>
      <TextArea value={note} onValue={setNote} placeholder={t('training.sessionNote')} rows={3} />
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          feedback={false}
          onClick={() => {
            const wasFinished = session.finished;
            const summary = finishSession(session, wellbeing, note);
            haptic('success');
            close();
            if (wasFinished) {
              toast(t('training.saved'), { tone: 'success' });
              return;
            }
            fx(summary.records.length ? 'personal-record' : 'workout-done');
            setTimeout(() => openSheet((c) => <SummaryView summary={summary} close={c} />, { title: t('training.finished') }), 300);
          }}
        >
          {session.finished ? t('common.save') : t('training.finish')}
        </Button>
      </SheetActions>
    </Form>
  );
}

export function SessionScreen({ params }: RouteProps) {
  const session = sessions.byId(params.id);
  if (!session) {
    return (
      <Page title={t('training.workout')} back>
        <EmptyState icon="dumbbell" title={t('training.notFound')} />
      </Page>
    );
  }
  const total = session.exercises.reduce((n, x) => n + x.sets.length, 0);
  const done = session.exercises.reduce((n, x) => n + x.sets.filter((s) => s.done).length, 0);

  const remove = async (): Promise<void> => {
    if (await confirm({ title: t('training.deleteSession'), message: t('training.deleteSessionText'), confirmLabel: t('common.delete'), danger: true })) {
      sessions.remove(session.id);
      goBack();
    }
  };

  return (
    <Page title={session.title} back actions={<IconButton icon="trash" label={t('common.delete')} onClick={() => void remove()} />}>
      <div class="session-head">
        <span>
          {t('training.sessionHeader', {
            day: formatRelativeDay(session.date),
            time: session.end !== null ? t('time.range', { from: formatTime(session.start), to: formatTime(session.end) }) : formatTime(session.start),
          })}
        </span>
        {session.finished ? <Badge tone="positive">{t('training.finishedBadge')}</Badge> : <Badge tone="accent">{t('training.inProgress')}</Badge>}
      </div>
      <div class="session-progress">
        <ProgressBar value={done} max={Math.max(1, total)} />
        <span class="num">
          {t('training.setsProgress', { done, total })}
        </span>
      </div>

      <div class="session-list">
        {session.exercises.map((x) => (
          <ExerciseCard key={x.id} session={session} item={x} />
        ))}
      </div>

      <Button
        block
        icon="plus"
        onClick={() => openExercisePicker((e) => updateExercises(session, (list) => [...list, freeSessionExercise(e.id)]))}
      >
        {t('training.addExercise')}
      </Button>

      <Section>
        <Button
          variant="primary"
          size="lg"
          block
          icon="check"
          onClick={() => openSheet((close) => <FinishForm session={session} close={close} />, { title: session.finished ? t('common.note') : t('training.finishWorkout') })}
        >
          {session.finished ? t('training.wellbeingAndNote') : t('training.finishWorkout')}
        </Button>
      </Section>
    </Page>
  );
}
