import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { formatTime, today, type ISODate } from '@/core/date';
import { fx } from '@/core/fx';

import { t } from '@/core/i18n';
import { navigate } from '@/core/router';
import { Badge, Button, Card, Checkbox, ChoiceChips, cx, DateStrip, Field, List, ListRow, openSheet, Section } from '@/ui';
import { addExtra, clearItem, eatMeal, fmtAmount, fmtKcal, setItem } from './actions';
import { AmountForm, MacroSummary, openFoodPicker } from './components';
import { IntakeChecklist, WaterControl } from './IntakeScreens';
import { foodLog, foods, macrosOf, nutritionDay, type DayItem, type DayMeal, type FoodLogEntry } from './model';

function openItem(date: ISODate, day: DayMeal, it: DayItem): void {
  const food = foods.get(it.item.foodId);
  void openSheet(
    (close) => (
      <AmountForm
        foodId={it.item.foodId}
        initial={it.grams}
        submitLabel={t('nutrition.ate')}
        onSubmit={(grams) => setItem(date, day.meal, it.item, 'eaten', grams)}
        extra={
          <>
            <p class="sheet-note">{t('nutrition.plannedGrams', { grams: fmtAmount(it.item.foodId, it.item.grams) })}</p>
            {it.state !== 'skipped' && (
              <Button block onClick={() => { setItem(date, day.meal, it.item, 'skipped'); close(); }}>
                {t('nutrition.skip')}
              </Button>
            )}
            {it.state !== 'pending' && (
              <Button block variant="ghost" icon="history" onClick={() => { clearItem(date, it.item.id); close(); }}>
                {t('nutrition.undo')}
              </Button>
            )}
          </>
        }
        close={close}
      />
    ),
    { title: food?.name ?? '' },
  );
}

/** One planned meal: one-tap "ate everything", per-item check, tap to adjust. */
export function MealCard({ date, day }: { date: ISODate; day: DayMeal }) {
  const plan = day.items.reduce((s, i) => s + macrosOf(i.item.foodId, i.item.grams).kcal, 0);
  return (
    <Card padded={false} class={cx('meal', day.state === 'done' && 'is-done')}>
      <div class="meal__head">
        <div class="meal__title">
          <span>{day.meal.name}</span>
          <span class="meal__sub num">
            {day.meal.time !== null ? `${formatTime(day.meal.time)} · ` : ''}
            {t('nutrition.kcalValue', { n: fmtKcal(plan) })}
          </span>
        </div>
        {day.state === 'done' ? (
          <Badge tone="positive">{t('nutrition.mealState.done')}</Badge>
        ) : (
          <Button
            size="sm"
            variant="primary"
            icon="check"
            feedback="success"
            onClick={(e) => {
              eatMeal(date, day);
              fx('task-done', e.currentTarget);
            }}
          >
            {t('nutrition.ateAll')}
          </Button>
        )}
      </div>
      {day.items.map((it) => {
        const food = foods.get(it.item.foodId);
        const changed = it.state === 'eaten' && it.grams !== it.item.grams;
        return (
          <ListRow
            key={it.item.id}
            leading={
              <Checkbox
                checked={it.state === 'eaten'}
                label={food?.name ?? ''}
                onChange={(on) => (on ? setItem(date, day.meal, it.item, 'eaten') : clearItem(date, it.item.id))}
              />
            }
            title={<span class={it.state === 'skipped' ? 'task--done' : undefined}>{food?.name ?? '—'}</span>}
            subtitle={
              it.state === 'skipped'
                ? t('nutrition.skipped')
                : `${fmtAmount(it.item.foodId, it.grams)}${changed ? ` · ${t('nutrition.plannedGrams', { grams: fmtAmount(it.item.foodId, it.item.grams) })}` : ''}`
            }
            value={it.state === 'skipped' ? '' : fmtKcal(macrosOf(it.item.foodId, it.grams).kcal)}
            onClick={() => openItem(date, day, it)}
          />
        );
      })}
    </Card>
  );
}

function openExtra(e: FoodLogEntry): void {
  void openSheet(
    (close) => (
      <AmountForm
        foodId={e.foodId}
        initial={e.grams}
        submitLabel={t('common.save')}
        onSubmit={(grams) => foodLog.update(e.id, { grams })}
        extra={
          <Button variant="danger" block icon="trash" onClick={() => { foodLog.remove(e.id); close(); }}>
            {t('common.delete')}
          </Button>
        }
        close={close}
      />
    ),
    { title: foods.get(e.foodId)?.name ?? '' },
  );
}

function ExtraForm({ date, foodId, close }: { date: ISODate; foodId: string; close: () => void }) {
  const meals = nutritionDay(date).meals;
  const [mealId, setMealId] = useState<string | null>(null);
  const food = foods.get(foodId);
  return (
    <AmountForm
      foodId={foodId}
      initial={food?.portions[0]?.grams ?? 100}
      submitLabel={t('common.add')}
      onSubmit={(grams) => addExtra(date, foodId, grams, mealId)}
      extra={
        meals.length > 0 ? (
          <Field label={t('nutrition.toMeal')}>
            <ChoiceChips
              allowNone
              options={meals.map((m) => ({ value: m.meal.id, label: m.meal.name }))}
              value={mealId}
              onChange={setMealId}
            />
          </Field>
        ) : undefined
      }
      close={close}
    />
  );
}

export function openAddFood(date: ISODate): void {
  openFoodPicker((f) => void openSheet((close) => <ExtraForm date={date} foodId={f.id} close={close} />, { title: f.name }));
}

const foodDate = signal<ISODate | null>(null);

export function NutritionView() {
  const date = foodDate.value ?? today();
  const day = nutritionDay(date);
  return (
    <>
      <DateStrip value={date} onChange={(d) => (foodDate.value = d === today() ? null : d)} />
      <Section>
        <MacroSummary fact={day.fact} plan={day.plan} />
      </Section>

      <Section title={t('nutrition.meals')} action={<Button size="sm" variant="ghost" icon="plus" onClick={() => openAddFood(date)}>{t('nutrition.addFood')}</Button>}>
        {day.meals.length === 0 ? (
          <Card onClick={() => navigate('health/meals')}>
            <p class="today__setup-title">{t('nutrition.noPlan')}</p>
            <p class="today__setup-text">{t('nutrition.noPlanText')}</p>
          </Card>
        ) : (
          <div class="meals">
            {day.meals.map((m) => (
              <MealCard key={m.meal.id} date={date} day={m} />
            ))}
          </div>
        )}
      </Section>

      {day.extras.length > 0 && (
        <Section title={t('nutrition.outsidePlan')}>
          <List>
            {day.extras.map((e) => (
              <ListRow
                key={e.id}
                title={foods.get(e.foodId)?.name ?? '—'}
                subtitle={fmtAmount(e.foodId, e.grams)}
                value={fmtKcal(macrosOf(e.foodId, e.grams).kcal)}
                onClick={() => openExtra(e)}
              />
            ))}
          </List>
        </Section>
      )}

      <Section title={t('nutrition.intakeTitle')}>
        <Card>
          <WaterControl date={date} />
        </Card>
        <IntakeChecklist date={date} />
      </Section>

      <Section>
        <List>
          <ListRow icon="calendar" title={t('nutrition.mealPlan')} subtitle={t('nutrition.mealPlanSub')} chevron onClick={() => navigate('health/meals')} />
          <ListRow icon="utensils" title={t('nutrition.foods')} subtitle={t('nutrition.foodsSub')} chevron onClick={() => navigate('health/foods')} />
          <ListRow icon="pill" title={t('nutrition.intakeItems')} subtitle={t('nutrition.intakeSub')} chevron onClick={() => navigate('health/intake')} />
        </List>
      </Section>
    </>
  );
}

