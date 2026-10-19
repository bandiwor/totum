import { useState } from 'preact/hooks';
import { cycleDayLabel } from '@/core/cycle';
import { formatTime, today, type Minutes } from '@/core/date';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { newId } from '@/core/id';
import type { RouteProps } from '@/core/registry';
import { navigate } from '@/core/router';
import {
  Button,
  Card,
  ChoiceChips,
  CycleEditor,
  EmptyState,
  Form,
  IconButton,
  List,
  ListRow,
  openSheet,
  Page,
  Section,
  SheetActions,
  Switch,
  TextField,
  TimeField,
} from '@/ui';
import { fmtAmount, fmtG, fmtKcal, targets } from './actions';
import { AmountForm, openFoodPicker } from './components';
import { addMacros, foods, macrosOf, mealPlan, ZERO, type Macros, type PlannedMeal } from './model';

const PRESETS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

function mealsMacros(meals: readonly PlannedMeal[]): Macros {
  return meals.flatMap((m) => m.items).reduce((s, i) => addMacros(s, macrosOf(i.foodId, i.grams)), ZERO);
}

const totalLine = (m: Macros): string => t('nutrition.dayTotal', { kcal: fmtKcal(m.kcal), p: fmtG(m.p), f: fmtG(m.f), c: fmtG(m.c) });

export function MealPlanScreen() {
  const cycle = mealPlan.value.value.cycle;
  const create = (): void => {
    mealPlan.set({ cycle: { anchor: today(), days: Array.from({ length: 3 }, () => []), weekAligned: false } });
    haptic('success');
  };
  return (
    <Page title={t('nutrition.mealPlan')} back>
      {!cycle ? (
        <EmptyState icon="utensils" title={t('nutrition.noPlan')} text={t('nutrition.noPlanText')} action={<Button variant="primary" icon="plus" onClick={create}>{t('nutrition.createPlan')}</Button>} />
      ) : (
        <CycleEditor
          cycle={cycle}
          onChange={(c) => mealPlan.set({ cycle: c })}
          makeDay={() => []}
          summary={(day) => (day.length ? totalLine(mealsMacros(day)) : t('nutrition.emptyDay'))}
          onOpenDay={(i) => navigate(`health/meals/day/${i}`)}
          title={t('nutrition.planDays')}
        />
      )}
    </Page>
  );
}

function MealForm({ meal, onSave, onDelete, close }: { meal: PlannedMeal | null; onSave: (m: Pick<PlannedMeal, 'name' | 'time'>) => void; onDelete?: () => void; close: () => void }) {
  const [name, setName] = useState(meal?.name ?? t('nutrition.mealPresets.breakfast'));
  const [time, setTime] = useState<Minutes | null>(meal?.time ?? null);
  const presetNames = PRESETS.map((p) => t(`nutrition.mealPresets.${p}`));
  return (
    <Form>
      <ChoiceChips options={presetNames.map((n) => ({ value: n, label: n }))} value={presetNames.includes(name) ? name : null} onChange={(v) => v && setName(v)} />
      <TextField label={t('nutrition.mealName')} value={name} onValue={setName} />
      <List>
        <ListRow title={t('nutrition.hasTime')} trailing={<Switch label={t('nutrition.hasTime')} checked={time !== null} onChange={(on) => setTime(on ? 13 * 60 : null)} />} />
      </List>
      {time !== null && <TimeField label={t('nutrition.mealTime')} value={time} onChange={setTime} />}
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!name.trim()}
          onClick={() => {
            onSave({ name: name.trim(), time });
            close();
          }}
        >
          {t('common.save')}
        </Button>
        {onDelete && (
          <Button variant="danger" block icon="trash" onClick={() => { onDelete(); close(); }}>
            {t('nutrition.deleteMeal')}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

export function MealPlanDayScreen({ params }: RouteProps) {
  const cycle = mealPlan.value.value.cycle;
  const index = Number(params.index);
  const day = cycle?.days[index];
  if (!cycle || !day) return <Page title={t('schedule.day')} back><EmptyState icon="utensils" title={t('common.notFound')} /></Page>;

  const setDay = (next: PlannedMeal[]): void => mealPlan.set({ cycle: { ...cycle, days: cycle.days.map((d, i) => (i === index ? next : d)) } });
  const setMeal = (id: string, fn: (m: PlannedMeal) => PlannedMeal): void => setDay(day.map((m) => (m.id === id ? fn(m) : m)));

  const editMeal = (meal: PlannedMeal | null): void =>
    void openSheet(
      (close) => (
        <MealForm
          meal={meal}
          onSave={(data) => (meal ? setMeal(meal.id, (m) => ({ ...m, ...data })) : setDay([...day, { id: newId(), items: [], ...data }]))}
          {...(meal ? { onDelete: () => setDay(day.filter((m) => m.id !== meal.id)) } : {})}
          close={close}
        />
      ),
      { title: meal ? meal.name : t('nutrition.newMeal') },
    );

  const addItem = (meal: PlannedMeal): void =>
    openFoodPicker(
      (f) =>
        void openSheet(
          (close) => (
            <AmountForm
              foodId={f.id}
              initial={f.portions[0]?.grams ?? 100}
              submitLabel={t('common.add')}
              onSubmit={(grams) => setMeal(meal.id, (m) => ({ ...m, items: [...m.items, { id: newId(), foodId: f.id, grams }] }))}
              close={close}
            />
          ),
          { title: f.name },
        ),
    );

  const editItem = (meal: PlannedMeal, itemId: string): void => {
    const item = meal.items.find((i) => i.id === itemId);
    if (!item) return;
    void openSheet(
      (close) => (
        <AmountForm
          foodId={item.foodId}
          initial={item.grams}
          submitLabel={t('common.save')}
          onSubmit={(grams) => setMeal(meal.id, (m) => ({ ...m, items: m.items.map((i) => (i.id === itemId ? { ...i, grams } : i)) }))}
          extra={
            <Button variant="danger" block icon="trash" onClick={() => { setMeal(meal.id, (m) => ({ ...m, items: m.items.filter((i) => i.id !== itemId) })); close(); }}>
              {t('common.delete')}
            </Button>
          }
          close={close}
        />
      ),
      { title: foods.get(item.foodId)?.name ?? '' },
    );
  };

  const total = mealsMacros(day);
  const r = targets.value;
  const sorted = [...day].sort((a, b) => (a.time ?? 1441) - (b.time ?? 1441));

  return (
    <Page title={cycleDayLabel(cycle, index)} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => editMeal(null)}>{t('nutrition.addMeal')}</Button>}>
      <Card>
        <p class="num">{totalLine(total)}</p>
        {r.ok && (
          <p class="macro__hint num">
            {t('nutrition.vsTargets', { kcal: fmtKcal(r.targets.kcal), p: fmtG(r.targets.p), f: fmtG(r.targets.f), c: fmtG(r.targets.c) })}
          </p>
        )}
      </Card>
      {sorted.length === 0 ? (
        <EmptyState icon="utensils" title={t('nutrition.emptyDay')} action={<Button variant="primary" icon="plus" onClick={() => editMeal(null)}>{t('nutrition.addMeal')}</Button>} />
      ) : (
        sorted.map((meal) => {
          const m = mealsMacros([meal]);
          return (
            <Section
              key={meal.id}
              title={meal.time !== null ? `${meal.name} · ${formatTime(meal.time)}` : meal.name}
              action={<IconButton icon="pencil" label={t('common.edit')} onClick={() => editMeal(meal)} />}
            >
              <List>
                {meal.items.map((i) => (
                  <ListRow
                    key={i.id}
                    title={foods.get(i.foodId)?.name ?? '—'}
                    subtitle={t('nutrition.kcalValue', { n: fmtKcal(macrosOf(i.foodId, i.grams).kcal) })}
                    value={fmtAmount(i.foodId, i.grams)}
                    onClick={() => editItem(meal, i.id)}
                  />
                ))}
                <ListRow icon="plus" title={t('nutrition.addItem')} subtitle={totalLine(m)} onClick={() => addItem(meal)} />
              </List>
            </Section>
          );
        })
      )}
    </Page>
  );
}
