import { useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import {
  Button,
  ChoiceChips,
  colorVar,
  confirm,
  EmptyState,
  Field,
  Form,
  List,
  ListRow,
  NumberStepper,
  openSheet,
  SheetActions,
  Switch,
  TextArea,
  TextField,
} from '@/ui';
import { activeExercises, categories, exercises, MEASURES, measureLabel, sessions, sortedCategories, templates, type Exercise, type Measure } from './model';
import { t } from '@/core/i18n';

export function ExerciseForm({
  exercise,
  close,
  onCreated,
  initialName = '',
}: {
  exercise: Exercise | null;
  close: () => void;
  onCreated?: (e: Exercise) => void;
  initialName?: string;
}) {
  const [name, setName] = useState(exercise?.name ?? initialName);
  const [categoryId, setCategoryId] = useState(exercise?.categoryId ?? sortedCategories.value[0]?.id ?? null);
  const [measure, setMeasure] = useState<Measure>(exercise?.measure ?? 'weight');
  const [step, setStep] = useState(exercise?.step ?? 2.5);
  const [note, setNote] = useState(exercise?.note ?? '');
  const [archived, setArchived] = useState(exercise?.archived ?? false);
  const used =
    exercise !== null &&
    (sessions.all.value.some((s) => s.exercises.some((x) => x.exerciseId === exercise.id)) ||
      templates.all.value.some((t) => t.exercises.some((x) => x.exerciseId === exercise.id)));

  const save = (): void => {
    const data = { name: name.trim(), categoryId, measure, step, note: note.trim(), archived };
    if (!data.name) return;
    if (exercise) exercises.update(exercise.id, data);
    else onCreated?.(exercises.add(data));
    haptic('success');
    close();
  };

  return (
    <Form>
      <TextField label={t('common.name')} value={name} onValue={setName} placeholder={t('training.exercisePlaceholder')} autoFocus={!exercise} />
      <Field label={t('training.category')}>
        <ChoiceChips
          allowNone
          options={sortedCategories.value.map((c) => ({ value: c.id, label: c.name, color: colorVar(c.color) }))}
          value={categoryId}
          onChange={setCategoryId}
        />
      </Field>
      <Field label={t('training.measureLabel')}>
        <ChoiceChips
          options={MEASURES.map((m) => ({ value: m, label: measureLabel(m) }))}
          value={measure}
          onChange={(m) => {
            if (!m) return;
            setMeasure(m);
            setStep(m === 'time' ? 5 : m === 'reps' ? 1 : 2.5);
          }}
        />
      </Field>
      {measure !== 'reps' && (
        <NumberStepper
          label={measure === 'time' ? t('training.progressionStep') : t('training.weightStep')}
          value={step}
          step={measure === 'time' ? 5 : 0.5}
          min={measure === 'time' ? 1 : 0.5}
          precision={measure === 'time' ? 0 : 2}
          unit={measure === 'time' ? t('units.sec') : t('units.kg')}
          onChange={setStep}
        />
      )}
      <TextArea value={note} onValue={setNote} placeholder={t('training.exerciseNote')} rows={2} />
      {exercise && (
        <List>
          <ListRow title={t('common.archived')} subtitle={t('training.archivedHint')} trailing={<Switch label={t('common.archive')} checked={archived} onChange={setArchived} />} />
        </List>
      )}
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!name.trim()} feedback={false} onClick={save}>
          {t('common.save')}
        </Button>
        {exercise && !used && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={async () => {
              if (await confirm({ title: t('schedule.deleteNamed', { name: exercise.name }), confirmLabel: t('common.delete'), danger: true })) {
                exercises.remove(exercise.id);
                close();
              }
            }}
          >
            {t('common.delete')}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

export function openExerciseForm(exercise: Exercise | null, onCreated?: (e: Exercise) => void, initialName = ''): void {
  openSheet((close) => <ExerciseForm exercise={exercise} close={close} initialName={initialName} {...(onCreated ? { onCreated } : {})} />, {
    title: exercise ? exercise.name : t('training.newExercise'),
  });
}

/** Search + category filter + "create new". Calls `onPick` with the chosen exercise. */
export function ExercisePicker({ onPick, close }: { onPick: (e: Exercise) => void; close: () => void }) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const list = activeExercises.value.filter((e) => (!cat || e.categoryId === cat) && (!q || e.name.toLowerCase().includes(q)));
  const pick = (e: Exercise): void => {
    haptic('light');
    onPick(e);
    close();
  };

  return (
    <div class="picker">
      <TextField value={query} onValue={setQuery} placeholder={t('training.search')} type="search" />
      <ChoiceChips
        allowNone
        options={sortedCategories.value.map((c) => ({ value: c.id, label: c.name, color: colorVar(c.color) }))}
        value={cat}
        onChange={setCat}
      />
      {list.length === 0 ? (
        <EmptyState icon="dumbbell" title={q ? t('common.notFound') : t('training.noExercises')} />
      ) : (
        <List>
          {list.map((e) => (
            <ListRow
              key={e.id}
              leading={<span class="color-dot" style={{ background: colorVar(categories.get(e.categoryId ?? '')?.color ?? 'c8') }} />}
              title={e.name}
              subtitle={measureLabel(e.measure)}
              onClick={() => pick(e)}
            />
          ))}
        </List>
      )}
      <Button
        block
        icon="plus"
        onClick={() =>
          openExerciseForm(
            null,
            (e) => {
              onPick(e);
              close();
            },
            query.trim(),
          )
        }
      >
        {query.trim() ? t('training.createNamed', { name: query.trim() }) : t('training.newExercise')}
      </Button>
    </div>
  );
}

export function openExercisePicker(onPick: (e: Exercise) => void): void {
  openSheet((close) => <ExercisePicker onPick={onPick} close={close} />, { title: t('training.exercise'), fullscreen: true });
}
