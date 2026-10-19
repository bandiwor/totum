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
import { exercises, formatTarget, program, ruleLabel, templates, type Exercise, type PlannedExercise, type ProgressionRule, type WorkoutTemplate } from './model';
import { t } from '@/core/i18n';

const rpeTargets = (): { value: number; label: string }[] => [7, 7.5, 8, 8.5, 9].map((value) => ({ value, label: t('training.rpeOption', { value }) }));

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


function PlannedForm({ planned, onSave, onDelete, close }: { planned: PlannedExercise; onSave: (p: PlannedExercise) => void; onDelete: () => void; close: () => void }) {
  const exercise = exercises.get(planned.exerciseId);
  const [d, setD] = useState(planned);
  const patch = (p: Partial<PlannedExercise>): void => setD((cur) => ({ ...cur, ...p }));
  if (!exercise) return null;
  const isTime = exercise.measure === 'time';
  const unit = isTime ? t('units.sec') : t('units.reps');
  const rules: ProgressionRule[] = exercise.measure === 'weight' ? ['double', 'linear', 'reps', 'none'] : ['reps', 'none'];

  return (
    <Form>
      <Field label={t('training.progression')} hint={t(`training.ruleHint.${d.rule}`)}>
        <ChoiceChips options={rules.map((r) => ({ value: r, label: ruleLabel(r) }))} value={d.rule} onChange={(rule) => rule && patch({ rule })} />
      </Field>
      <NumberStepper label={t('training.sets')} value={d.sets} min={1} max={10} onChange={(sets) => patch({ sets })} />
      {d.rule === 'double' ? (
        <div class="ui-row2">
          <NumberStepper label={t('training.repsFrom')} value={d.repMin} min={1} max={d.repMax} onChange={(repMin) => patch({ repMin, repGoal: Math.max(repMin, Math.min(d.repGoal, d.repMax)) })} />
          <NumberStepper label={t('training.repsTo')} value={d.repMax} min={d.repMin} max={50} onChange={(repMax) => patch({ repMax, repGoal: Math.min(d.repGoal, repMax) })} />
        </div>
      ) : null}
      <NumberStepper
        label={d.rule === 'double' ? t('training.goalNow') : isTime ? t('training.time') : t('training.reps')}
        value={d.repGoal}
        step={isTime ? 5 : 1}
        min={d.rule === 'double' ? d.repMin : 1}
        max={d.rule === 'double' ? d.repMax : 600}
        unit={unit}
        onChange={(repGoal) => patch(d.rule === 'double' ? { repGoal } : { repGoal, repMin: repGoal, repMax: repGoal })}
      />
      {exercise.measure !== 'time' && (
        <NumberStepper
          label={exercise.measure === 'reps' ? t('training.extraWeight') : t('training.workingWeight')}
          value={d.weight}
          step={d.step || 2.5}
          precision={2}
          unit={t('units.kg')}
          onChange={(weight) => patch({ weight })}
        />
      )}
      {d.rule !== 'none' && (
        <NumberStepper
          label={exercise.measure === 'weight' ? t('training.weightStep') : isTime ? t('training.stepSeconds') : t('training.step')}
          value={d.step}
          step={isTime ? 5 : 0.5}
          min={isTime ? 1 : 0.5}
          precision={2}
          unit={isTime ? t('units.sec') : t('units.kg')}
          onChange={(step) => patch({ step })}
        />
      )}
      <Field label={t('training.targetEffort')} hint={t('training.targetEffortHint')}>
        <ChoiceChips allowNone options={rpeTargets()} value={d.rpe} onChange={(rpe) => patch({ rpe })} />
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
          {t('common.save')}
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
          {t('training.removeFromWorkout')}
        </Button>
      </SheetActions>
    </Form>
  );
}

function createTemplate(): void {
  const tpl = templates.add({ name: t('training.newWorkout'), color: 'c1', duration: 75, exercises: [] });
  haptic('success');
  navigate(`health/template/${tpl.id}`);
}

export function TemplatesScreen() {
  const list = templates.all.value;
  return (
    <Page title={t('training.workouts')} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={createTemplate}>{t('common.new')}</Button>}>
      {list.length === 0 ? (
        <EmptyState
          icon="dumbbell"
          title={t('training.noWorkouts')}
          text={t('training.noWorkoutsText')}
          action={<Button variant="primary" icon="plus" onClick={createTemplate}>{t('training.create')}</Button>}
        />
      ) : (
        <Section>
          <List>
            {list.map((tpl) => (
              <ListRow
                key={tpl.id}
                leading={<span class="color-dot" style={{ background: colorVar(tpl.color) }} />}
                title={tpl.name}
                subtitle={tpl.exercises.map((x) => exercises.get(x.exerciseId)?.name).filter(Boolean).join(', ') || t('training.empty')}
                chevron
                onClick={() => navigate(`health/template/${tpl.id}`)}
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
  const tpl = templates.byId(params.id);
  if (!tpl) return <Page title={t('training.workout')} back><EmptyState icon="dumbbell" title={t('common.notFound')} /></Page>;
  const patch = (p: Partial<WorkoutTemplate>): void => void templates.update(tpl.id, p);
  const setList = (list: PlannedExercise[]): void => patch({ exercises: list });

  const edit = (p: PlannedExercise): void =>
    void openSheet(
      (close) => (
        <PlannedForm
          planned={p}
          onSave={(next) => setList(tpl.exercises.map((x) => (x.id === p.id ? next : x)))}
          onDelete={() => setList(tpl.exercises.filter((x) => x.id !== p.id))}
          close={close}
        />
      ),
      { title: exercises.get(p.exerciseId)?.name ?? t('training.exercise') },
    );

  const move = (index: number, dir: -1 | 1): void => {
    const list = [...tpl.exercises];
    const [item] = list.splice(index, 1);
    if (!item) return;
    list.splice(index + dir, 0, item);
    setList(list);
  };

  const remove = async (): Promise<void> => {
    if (isInProgram(tpl.id)) {
      await confirm({ title: t('training.inProgram'), message: t('training.inProgramText'), confirmLabel: t('common.understood') });
      return;
    }
    if (await confirm({ title: t('schedule.deleteNamed', { name: tpl.name }), message: t('training.deleteKeepsLog'), confirmLabel: t('common.delete'), danger: true })) {
      templates.remove(tpl.id);
      navigate('health/templates', { replace: true });
    }
  };

  return (
    <Page title={tpl.name} back>
      <Section>
        <Form>
          <TextField label={t('common.name')} value={tpl.name} onValue={(name) => patch({ name })} />
          <Field label={t('common.color')}>
            <ColorPicker value={tpl.color} onChange={(color: ColorKey) => patch({ color })} />
          </Field>
          <NumberStepper label={t('training.duration')} value={tpl.duration} step={5} min={10} max={300} unit={t('units.min')} onChange={(duration) => patch({ duration })} />
        </Form>
      </Section>
      <Section title={t('training.exercises')}>
        {tpl.exercises.length > 0 && (
          <List>
            {tpl.exercises.map((p, i) => {
              const e = exercises.get(p.exerciseId);
              return (
                <ListRow
                  key={p.id}
                  title={e?.name ?? t('training.deleted')}
                  subtitle={e ? t('training.targetLine', { target: formatTarget(p, e.measure), rule: ruleLabel(p.rule).toLowerCase() }) : ''}
                  trailing={
                    i > 0 ? (
                      <IconButton
                        icon="chevronDown"
                        class="rotate-180"
                        label={t('training.up')}
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
              setList([...tpl.exercises, p]);
              setTimeout(() => edit(p), 320);
            })
          }
        >
          {t('training.addExercise')}
        </Button>
      </Section>
      <Section>
        <Button variant="danger" block icon="trash" onClick={() => void remove()}>
          {t('training.deleteWorkout')}
        </Button>
      </Section>
    </Page>
  );
}
