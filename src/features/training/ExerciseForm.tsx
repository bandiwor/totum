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
import { activeExercises, categories, exercises, MEASURE_LABELS, sessions, sortedCategories, templates, type Exercise, type Measure } from './model';

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
      <TextField label="Название" value={name} onValue={setName} placeholder="Жим лёжа" autoFocus={!exercise} />
      <Field label="Категория">
        <ChoiceChips
          allowNone
          options={sortedCategories.value.map((c) => ({ value: c.id, label: c.name, color: colorVar(c.color) }))}
          value={categoryId}
          onChange={setCategoryId}
        />
      </Field>
      <Field label="Как считать">
        <ChoiceChips
          options={(Object.keys(MEASURE_LABELS) as Measure[]).map((m) => ({ value: m, label: MEASURE_LABELS[m] }))}
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
          label={measure === 'time' ? 'Шаг прогрессии' : 'Шаг веса'}
          value={step}
          step={measure === 'time' ? 5 : 0.5}
          min={measure === 'time' ? 1 : 0.5}
          precision={measure === 'time' ? 0 : 2}
          unit={measure === 'time' ? 'с' : 'кг'}
          onChange={setStep}
        />
      )}
      <TextArea value={note} onValue={setNote} placeholder="Заметка: техника, настройки тренажёра…" rows={2} />
      {exercise && (
        <List>
          <ListRow title="В архиве" subtitle="Скрыто из выбора, история сохраняется" trailing={<Switch label="Архив" checked={archived} onChange={setArchived} />} />
        </List>
      )}
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!name.trim()} feedback={false} onClick={save}>
          Сохранить
        </Button>
        {exercise && !used && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={async () => {
              if (await confirm({ title: `Удалить «${exercise.name}»?`, confirmLabel: 'Удалить', danger: true })) {
                exercises.remove(exercise.id);
                close();
              }
            }}
          >
            Удалить
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

export function openExerciseForm(exercise: Exercise | null, onCreated?: (e: Exercise) => void, initialName = ''): void {
  openSheet((close) => <ExerciseForm exercise={exercise} close={close} initialName={initialName} {...(onCreated ? { onCreated } : {})} />, {
    title: exercise ? exercise.name : 'Новое упражнение',
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
      <TextField value={query} onValue={setQuery} placeholder="Поиск" type="search" />
      <ChoiceChips
        allowNone
        options={sortedCategories.value.map((c) => ({ value: c.id, label: c.name, color: colorVar(c.color) }))}
        value={cat}
        onChange={setCat}
      />
      {list.length === 0 ? (
        <EmptyState icon="dumbbell" title={q ? 'Не найдено' : 'Упражнений нет'} />
      ) : (
        <List>
          {list.map((e) => (
            <ListRow
              key={e.id}
              leading={<span class="color-dot" style={{ background: colorVar(categories.get(e.categoryId ?? '')?.color ?? 'c8') }} />}
              title={e.name}
              subtitle={MEASURE_LABELS[e.measure]}
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
        {query.trim() ? `Создать «${query.trim()}»` : 'Новое упражнение'}
      </Button>
    </div>
  );
}

export function openExercisePicker(onPick: (e: Exercise) => void): void {
  openSheet((close) => <ExercisePicker onPick={onPick} close={close} />, { title: 'Упражнение', fullscreen: true });
}
