import { useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { newId } from '@/core/id';
import type { RouteProps } from '@/core/registry';
import { navigate } from '@/core/router';
import {
  Button,
  ChoiceChips,
  ColorPicker,
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
  Section,
  SheetActions,
  TextField,
  type ColorKey,
} from '@/ui';
import { openExercisePicker } from './ExerciseForm';
import { exercises, formatTarget, program, RULE_LABELS, templates, type Exercise, type PlannedExercise, type ProgressionRule, type WorkoutTemplate } from './model';

const RPE_TARGETS = [7, 7.5, 8, 8.5, 9].map((v) => ({ value: v, label: `RPE ${v}` }));

export function defaultPlanned(e: Exercise): PlannedExercise {
  const base = { id: newId(), exerciseId: e.id, sets: 3, rpe: null, step: e.step };
  switch (e.measure) {
    case 'weight':
      return { ...base, repMin: 8, repMax: 12, repGoal: 8, weight: 20, rule: 'double' };
    case 'reps':
      return { ...base, repMin: 8, repMax: 8, repGoal: 8, weight: 0, rule: 'reps' };
    case 'time':
      return { ...base, repMin: 30, repMax: 30, repGoal: 30, weight: 0, rule: 'reps' };
  }
}

const RULE_HINTS: Record<ProgressionRule, string> = {
  double: 'Повторы растут до верха диапазона, потом +вес и повторы сначала.',
  linear: 'Сделал цель во всех подходах — в следующий раз +вес.',
  reps: 'Сделал цель — в следующий раз +1 повтор (или +шаг секунд).',
  none: 'План не меняется сам.',
};

function PlannedForm({ planned, onSave, onDelete, close }: { planned: PlannedExercise; onSave: (p: PlannedExercise) => void; onDelete: () => void; close: () => void }) {
  const exercise = exercises.get(planned.exerciseId);
  const [d, setD] = useState(planned);
  const patch = (p: Partial<PlannedExercise>): void => setD((cur) => ({ ...cur, ...p }));
  if (!exercise) return null;
  const isTime = exercise.measure === 'time';
  const unit = isTime ? 'с' : 'повт';
  const rules: ProgressionRule[] = exercise.measure === 'weight' ? ['double', 'linear', 'reps', 'none'] : ['reps', 'none'];

  return (
    <Form>
      <Field label="Прогрессия" hint={RULE_HINTS[d.rule]}>
        <ChoiceChips options={rules.map((r) => ({ value: r, label: RULE_LABELS[r] }))} value={d.rule} onChange={(rule) => rule && patch({ rule })} />
      </Field>
      <NumberStepper label="Подходов" value={d.sets} min={1} max={10} onChange={(sets) => patch({ sets })} />
      {d.rule === 'double' ? (
        <div class="ui-row2">
          <NumberStepper label="Повторы от" value={d.repMin} min={1} max={d.repMax} onChange={(repMin) => patch({ repMin, repGoal: Math.max(repMin, Math.min(d.repGoal, d.repMax)) })} />
          <NumberStepper label="до" value={d.repMax} min={d.repMin} max={50} onChange={(repMax) => patch({ repMax, repGoal: Math.min(d.repGoal, repMax) })} />
        </div>
      ) : null}
      <NumberStepper
        label={d.rule === 'double' ? 'Цель сейчас' : isTime ? 'Время' : 'Повторы'}
        value={d.repGoal}
        step={isTime ? 5 : 1}
        min={d.rule === 'double' ? d.repMin : 1}
        max={d.rule === 'double' ? d.repMax : 600}
        unit={unit}
        onChange={(repGoal) => patch(d.rule === 'double' ? { repGoal } : { repGoal, repMin: repGoal, repMax: repGoal })}
      />
      {exercise.measure !== 'time' && (
        <NumberStepper
          label={exercise.measure === 'reps' ? 'Доп. вес' : 'Рабочий вес'}
          value={d.weight}
          step={d.step || 2.5}
          precision={2}
          unit="кг"
          onChange={(weight) => patch({ weight })}
        />
      )}
      {d.rule !== 'none' && (
        <NumberStepper
          label={exercise.measure === 'weight' ? 'Шаг веса' : isTime ? 'Шаг, секунд' : 'Шаг'}
          value={d.step}
          step={isTime ? 5 : 0.5}
          min={isTime ? 1 : 0.5}
          precision={2}
          unit={isTime ? 'с' : 'кг'}
          onChange={(step) => patch({ step })}
        />
      )}
      <Field label="Целевое усилие" hint="Подходы тяжелее этого RPE не считаются «чистыми» для прогрессии.">
        <ChoiceChips allowNone options={RPE_TARGETS} value={d.rpe} onChange={(rpe) => patch({ rpe })} />
      </Field>
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => {
            onSave(d);
            close();
          }}
        >
          Сохранить
        </Button>
        <Button
          variant="danger"
          block
          icon="trash"
          onClick={() => {
            onDelete();
            close();
          }}
        >
          Убрать из тренировки
        </Button>
      </SheetActions>
    </Form>
  );
}

function createTemplate(): void {
  const t = templates.add({ name: 'Новая тренировка', color: 'c1', duration: 75, exercises: [] });
  haptic('success');
  navigate(`health/template/${t.id}`);
}

export function TemplatesScreen() {
  const list = templates.all.value;
  return (
    <Page title="Тренировки" back actions={<Button size="sm" variant="ghost" icon="plus" onClick={createTemplate}>Новая</Button>}>
      {list.length === 0 ? (
        <EmptyState
          icon="dumbbell"
          title="Тренировок нет"
          text="Тренировка — набор упражнений с планом. Потом ставишь её в программу на нужные дни."
          action={<Button variant="primary" icon="plus" onClick={createTemplate}>Создать</Button>}
        />
      ) : (
        <Section>
          <List>
            {list.map((t) => (
              <ListRow
                key={t.id}
                leading={<span class="color-dot" style={{ background: colorVar(t.color) }} />}
                title={t.name}
                subtitle={t.exercises.map((x) => exercises.get(x.exerciseId)?.name).filter(Boolean).join(', ') || 'Пусто'}
                chevron
                onClick={() => navigate(`health/template/${t.id}`)}
              />
            ))}
          </List>
        </Section>
      )}
    </Page>
  );
}

function isInProgram(id: string): boolean {
  return program.value.value.cycle?.days.some((d) => d.some((s) => s.templateId === id)) ?? false;
}

export function TemplateEditor({ params }: RouteProps) {
  const t = templates.byId(params.id);
  if (!t) return <Page title="Тренировка" back><EmptyState icon="dumbbell" title="Не найдено" /></Page>;
  const patch = (p: Partial<WorkoutTemplate>): void => void templates.update(t.id, p);
  const setList = (list: PlannedExercise[]): void => patch({ exercises: list });

  const edit = (p: PlannedExercise): void =>
    void openSheet(
      (close) => (
        <PlannedForm
          planned={p}
          onSave={(next) => setList(t.exercises.map((x) => (x.id === p.id ? next : x)))}
          onDelete={() => setList(t.exercises.filter((x) => x.id !== p.id))}
          close={close}
        />
      ),
      { title: exercises.get(p.exerciseId)?.name ?? 'Упражнение' },
    );

  const move = (index: number, dir: -1 | 1): void => {
    const list = [...t.exercises];
    const [item] = list.splice(index, 1);
    if (!item) return;
    list.splice(index + dir, 0, item);
    setList(list);
  };

  const remove = async (): Promise<void> => {
    if (isInProgram(t.id)) {
      await confirm({ title: 'Тренировка стоит в программе', message: 'Сначала убери её из дней программы.', confirmLabel: 'Понятно' });
      return;
    }
    if (await confirm({ title: `Удалить «${t.name}»?`, message: 'Журнал прошлых тренировок сохранится.', confirmLabel: 'Удалить', danger: true })) {
      templates.remove(t.id);
      navigate('health/templates', { replace: true });
    }
  };

  return (
    <Page title={t.name} back>
      <Section>
        <Form>
          <TextField label="Название" value={t.name} onValue={(name) => patch({ name })} />
          <Field label="Цвет">
            <ColorPicker value={t.color} onChange={(color: ColorKey) => patch({ color })} />
          </Field>
          <NumberStepper label="Длительность" value={t.duration} step={5} min={10} max={300} unit="мин" onChange={(duration) => patch({ duration })} />
        </Form>
      </Section>
      <Section title="Упражнения">
        {t.exercises.length > 0 && (
          <List>
            {t.exercises.map((p, i) => {
              const e = exercises.get(p.exerciseId);
              return (
                <ListRow
                  key={p.id}
                  title={e?.name ?? 'Удалено'}
                  subtitle={e ? `${formatTarget(p, e.measure)} · ${RULE_LABELS[p.rule].toLowerCase()}` : ''}
                  trailing={
                    i > 0 ? (
                      <IconButton
                        icon="chevronDown"
                        class="rotate-180"
                        label="Выше"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          move(i, -1);
                        }}
                      />
                    ) : undefined
                  }
                  onClick={() => edit(p)}
                />
              );
            })}
          </List>
        )}
        <Button
          block
          icon="plus"
          onClick={() =>
            openExercisePicker((e) => {
              const p = defaultPlanned(e);
              setList([...t.exercises, p]);
              setTimeout(() => edit(p), 320);
            })
          }
        >
          Добавить упражнение
        </Button>
      </Section>
      <Section>
        <Button variant="danger" block icon="trash" onClick={() => void remove()}>
          Удалить тренировку
        </Button>
      </Section>
    </Page>
  );
}
