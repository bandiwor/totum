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
  WELLBEING_LABELS,
  type Exercise,
  type SessionExercise,
  type SetLog,
  type WorkoutSession,
} from './model';

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
          label={exercise.measure === 'reps' ? 'Доп. вес' : 'Вес'}
          value={d.weight}
          step={exercise.step || 2.5}
          precision={2}
          unit="кг"
          onChange={(weight) => setD({ ...d, weight })}
        />
      )}
      <NumberStepper
        label={isTime ? 'Время' : 'Повторы'}
        value={d.reps}
        step={isTime ? 5 : 1}
        unit={isTime ? 'с' : 'повт'}
        onChange={(reps) => setD({ ...d, reps })}
      />
      <Field label="RPE (10 = отказ)">
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
          Засчитать подход
        </Button>
        {d.done && (
          <Button
            block
            onClick={() => {
              onSave({ ...d, done: false });
              close();
            }}
          >
            Снять отметку
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
          Удалить подход
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
      { title: `${exercise.name} · подход ${index + 1}` },
    );
  };

  const addSet = (): void => {
    const last = item.sets[item.sets.length - 1];
    const next: SetLog = { weight: last?.weight ?? 0, reps: last?.reps ?? 10, rpe: null, done: false };
    updateExercises(session, (list) => list.map((x) => (x.id === item.id ? { ...x, sets: [...x.sets, next] } : x)));
    haptic('light');
  };

  const remove = async (): Promise<void> => {
    if (await confirm({ title: `Убрать «${exercise.name}» из тренировки?`, confirmLabel: 'Убрать', danger: true })) {
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
        <IconButton icon="trash" label="Убрать" onClick={() => void remove()} />
      </div>
      {item.target && <p class="ex-card__meta">План: {formatTarget(item.target, exercise.measure)}</p>}
      {prev && <p class="ex-card__meta">Прошлый раз: {prev.map((s) => formatSet(s, exercise.measure)).join(' · ')}</p>}
      <div class="ex-card__sets">
        {item.sets.map((s, i) => (
          <div key={i} class={s.done ? 'set-row is-done' : 'set-row'}>
            <span class="set-row__n num">{i + 1}</span>
            <button type="button" class="set-row__value num" onClick={() => editSet(i)}>
              {exercise.measure === 'weight' && (
                <>
                  <b>{formatKg(s.weight)}</b> кг × <b>{s.reps}</b>
                </>
              )}
              {exercise.measure === 'reps' && (
                <>
                  <b>{s.reps}</b> повт{s.weight > 0 ? ` · +${formatKg(s.weight)} кг` : ''}
                </>
              )}
              {exercise.measure === 'time' && (
                <>
                  <b>{s.reps}</b> с
                </>
              )}
              {s.rpe !== null && <Badge>RPE {s.rpe}</Badge>}
            </button>
            <Checkbox
              checked={s.done}
              label={`Подход ${i + 1}`}
              celebrate="set-done"
              {...(category ? { color: colorVar(category.color) } : {})}
              onChange={(done) => updateSet(session, item.id, i, { done })}
            />
          </div>
        ))}
      </div>
      <button type="button" class="ex-card__add" onClick={addSet}>
        + подход
      </button>
    </Card>
  );
}

function SummaryView({ summary, close }: { summary: FinishSummary; close: () => void }) {
  return (
    <>
      {summary.records.length > 0 && (
        <Section title="Рекорды">
          <List>
            {summary.records.map((r) => (
              <ListRow key={r} icon="sparkles" iconColor="var(--warning)" title={r} subtitle="Лучший расчётный максимум" />
            ))}
          </List>
        </Section>
      )}
      <Section title="План на следующий раз">
        {summary.changes.length ? (
          <List>
            {summary.changes.map((c) => (
              <ListRow key={c.name} icon="zap" iconColor="var(--accent-2)" title={c.name} subtitle={c.text} />
            ))}
          </List>
        ) : (
          <p class="sheet-note">Без изменений — держим текущие веса и цели.</p>
        )}
      </Section>
      <SheetActions>
        <Button variant="primary" size="lg" block onClick={close}>
          Отлично
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
      <Field label="Самочувствие">
        <ChoiceChips options={WELLBEING_LABELS.map((label, i) => ({ value: i + 1, label }))} value={wellbeing} onChange={setWellbeing} />
      </Field>
      <TextArea value={note} onValue={setNote} placeholder="Как прошло: сон, энергия, что болело…" rows={3} />
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
              toast('Сохранено', { tone: 'success' });
              return;
            }
            fx(summary.records.length ? 'personal-record' : 'workout-done');
            setTimeout(() => openSheet((c) => <SummaryView summary={summary} close={c} />, { title: 'Тренировка завершена' }), 300);
          }}
        >
          {session.finished ? 'Сохранить' : 'Завершить'}
        </Button>
      </SheetActions>
    </Form>
  );
}

export function SessionScreen({ params }: RouteProps) {
  const session = sessions.byId(params.id);
  if (!session) {
    return (
      <Page title="Тренировка" back>
        <EmptyState icon="dumbbell" title="Тренировка не найдена" />
      </Page>
    );
  }
  const total = session.exercises.reduce((n, x) => n + x.sets.length, 0);
  const done = session.exercises.reduce((n, x) => n + x.sets.filter((s) => s.done).length, 0);

  const remove = async (): Promise<void> => {
    if (await confirm({ title: 'Удалить запись тренировки?', message: 'Прогрессия, уже применённая к программе, не откатывается.', confirmLabel: 'Удалить', danger: true })) {
      sessions.remove(session.id);
      goBack();
    }
  };

  return (
    <Page title={session.title} back actions={<IconButton icon="trash" label="Удалить" onClick={() => void remove()} />}>
      <div class="session-head">
        <span>
          {formatRelativeDay(session.date)} · {formatTime(session.start)}
          {session.end !== null ? `–${formatTime(session.end)}` : ''}
        </span>
        {session.finished ? <Badge tone="positive">Завершена</Badge> : <Badge tone="accent">Идёт</Badge>}
      </div>
      <div class="session-progress">
        <ProgressBar value={done} max={Math.max(1, total)} />
        <span class="num">
          {done}/{total} подходов
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
        Добавить упражнение
      </Button>

      <Section>
        <Button
          variant="primary"
          size="lg"
          block
          icon="check"
          onClick={() => openSheet((close) => <FinishForm session={session} close={close} />, { title: session.finished ? 'Заметка' : 'Завершить тренировку' })}
        >
          {session.finished ? 'Самочувствие и заметка' : 'Завершить тренировку'}
        </Button>
      </Section>
    </Page>
  );
}
