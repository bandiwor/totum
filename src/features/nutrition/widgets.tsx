import { nowMinutes, today, type ISODate } from '@/core/date';
import type { DayMeal } from './model';
import { t } from '@/core/i18n';
import type { AgendaItem, QuickActionContext } from '@/core/registry';

import { Button, Card, Section } from '@/ui';
import { fmtKcal, targets, waterTarget } from './actions';
import { MacroSummary } from './components';
import { IntakeChecklist, WaterControl, doseLine } from './IntakeScreens';
import { MealCard, openAddFood } from './NutritionView';
import { WeightForm } from './BodyView';
import { intakeSlots, nutritionDay, waterOn, weightsByDate } from './model';
import { openHealthTab } from './healthTab';

export function NutritionWidget({ date }: { date: ISODate }) {
  const day = nutritionDay(date);
  if (day.meals.length === 0 && day.extras.length === 0 && !targets.value.ok) return null;
  const next = nextMeal(date, day.meals);
  return (
    <Section title={t('nutrition.tabs.food')} action={<Button size="sm" variant="ghost" icon="plus" onClick={() => openAddFood(date)}>{t('nutrition.addFood')}</Button>}>
      <MacroSummary fact={day.fact} plan={day.plan} compact />
      {next && <MealCard date={date} day={next} />}
      <Button block variant="ghost" onClick={() => openHealthTab('food')}>
        {t('nutrition.meals')}
      </Button>
    </Section>
  );
}

/** Today: the upcoming (or just-passed) unfinished meal; other days: the first unfinished one. */
function nextMeal(date: ISODate, meals: readonly DayMeal[]): DayMeal | undefined {
  const open = meals.filter((m) => m.state !== 'done');
  if (date !== today()) return open[0];
  const now = nowMinutes();
  return open.find((m) => m.meal.time === null || m.meal.time >= now - 60) ?? open[open.length - 1];
}

export function IntakeWidget({ date }: { date: ISODate }) {
  return (
    <Section title={t('nutrition.intakeTitle')}>
      <Card>
        <WaterControl date={date} />
      </Card>
      <IntakeChecklist date={date} />
    </Section>
  );
}

// ── Quick menu ─────────────────────────────────────────────────────────────

export function QuickFood({ close }: QuickActionContext) {
  const date = today();
  const day = nutritionDay(date);
  return (
    <div class="quick-stack">
      <MacroSummary fact={day.fact} plan={day.plan} compact />
      {day.meals.map((m) => (
        <MealCard key={m.meal.id} date={date} day={m} />
      ))}
      <Button
        block
        icon="plus"
        onClick={() => {
          close();
          setTimeout(() => openAddFood(date), 250);
        }}
      >
        {t('nutrition.addFood')}
      </Button>
    </div>
  );
}

export function QuickIntake() {
  const date = today();
  return (
    <div class="quick-stack">
      <Card>
        <WaterControl date={date} />
      </Card>
      <IntakeChecklist date={date} />
    </div>
  );
}

export function QuickWeight({ close }: QuickActionContext) {
  return <WeightForm close={close} />;
}

export function foodHint(): string | null {
  const r = targets.value;
  const fact = nutritionDay(today()).fact.kcal;
  return r.ok ? `${fmtKcal(fact)} / ${fmtKcal(r.targets.kcal)} ${t('units.kcal')}` : null;
}

export function intakeHint(): string | null {
  return t('nutrition.waterOf', { ml: waterOn(today()), target: waterTarget() });
}

export function weightHint(): string | null {
  const last = weightsByDate.value[weightsByDate.value.length - 1];
  return last ? t('nutrition.kgValue', { n: last.kg.toFixed(1) }) : null;
}

/** A meal around its time (±60 min) that isn't done yet makes "Еда" the top tile. */
export function foodRelevance(): number {
  const now = nowMinutes();
  return nutritionDay(today()).meals.some((m) => m.state !== 'done' && m.meal.time !== null && Math.abs(m.meal.time - now) <= 60) ? 0.8 : 0;
}

export function nutritionAgenda(date: ISODate): AgendaItem[] {
  const meals = nutritionDay(date)
    .meals.filter((m) => m.meal.time !== null)
    .map((m) => ({ id: m.meal.id, source: 'nutrition', title: m.meal.name, time: m.meal.time, done: m.state === 'done' }));
  const intakes = intakeSlots(date).map((s) => ({
    id: `${s.item.id}-${s.slot}`,
    source: 'intake',
    title: `${s.item.name} · ${doseLine(s.item)}`,
    time: s.time,
    done: !!s.entry,
  }));
  return [...meals, ...intakes];
}

