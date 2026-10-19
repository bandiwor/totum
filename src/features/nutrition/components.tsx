import { useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { Button, Card, ChoiceChips, EmptyState, List, ListRow, NumberStepper, openSheet, ProgressBar, ProgressRing, SheetActions, TextField } from '@/ui';
import { fmtG, fmtKcal, macroLine, targets } from './actions';
import { activeFoods, foods, per100, type Food, type Macros } from './model';
import { openFoodForm } from './FoodScreens';

/** Calories ring + protein/fat/carb bars: fact vs targets (or vs plan when no targets). */
export function MacroSummary({ fact, plan, compact = false }: { fact: Macros; plan: Macros; compact?: boolean }) {
  const r = targets.value;
  const goal = r.ok ? r.targets : null;
  const kcalGoal = goal?.kcal ?? plan.kcal;
  const left = kcalGoal - fact.kcal;
  const bars: { key: 'p' | 'f' | 'c'; label: string }[] = [
    { key: 'p', label: t('nutrition.protein') },
    { key: 'f', label: t('nutrition.fat') },
    { key: 'c', label: t('nutrition.carbs') },
  ];
  return (
    <Card>
      <div class="macro">
        <ProgressRing value={fact.kcal} max={Math.max(1, kcalGoal)} size={compact ? 64 : 80}>
          <span class="macro__kcal num">{fmtKcal(fact.kcal)}</span>
        </ProgressRing>
        <div class="macro__bars">
          {bars.map((b) => (
            <div key={b.key} class="macro__bar">
              <div class="macro__bar-head">
                <span>{b.label}</span>
                <span class="num">
                  {fmtG(fact[b.key])}
                  {goal ? ` / ${fmtG(goal[b.key])}` : ''}
                </span>
              </div>
              <ProgressBar value={fact[b.key]} max={Math.max(1, goal?.[b.key] ?? plan[b.key])} />
            </div>
          ))}
        </div>
      </div>
      <p class="macro__foot num">
        {kcalGoal > 0 &&
          (left >= 0 ? t('nutrition.left', { kcal: fmtKcal(left) }) : t('nutrition.over', { kcal: fmtKcal(-left) }))}
        {plan.kcal > 0 && goal ? ` · ${t('nutrition.planned', { kcal: fmtKcal(plan.kcal) })}` : ''}
      </p>
      {!goal && !compact && <p class="macro__hint">{t('nutrition.noTargetsHint')}</p>}
    </Card>
  );
}

export function foodSubtitle(food: Food): string {
  const m = per100(food);
  return t('nutrition.per100Line', {
    kcal: fmtKcal(m.kcal),
    p: fmtG(m.p),
    f: fmtG(m.f),
    c: fmtG(m.c),
    unit: t(`nutrition.unitShort.${food.unit}`),
  });
}

/** Grams with portion shortcuts. */
export function AmountForm({
  foodId,
  initial,
  submitLabel,
  onSubmit,
  extra,
  close,
}: {
  foodId: string;
  initial: number;
  submitLabel: string;
  onSubmit: (grams: number) => void;
  extra?: preact.ComponentChildren;
  close: () => void;
}) {
  const food = foods.get(foodId);
  const [grams, setGrams] = useState(initial);
  if (!food) return null;
  const m = per100(food);
  const k = grams / 100;
  return (
    <div class="ui-form">
      {food.portions.length > 0 && (
        <ChoiceChips
          options={food.portions.flatMap((p) => [1, 2, 3].map((n) => ({ value: n * p.grams, label: n === 1 ? p.name : t('nutrition.portionTimes', { name: p.name, n }) })))}
          value={grams}
          onChange={(v) => v !== null && setGrams(v)}
        />
      )}
      <NumberStepper
        label={t('nutrition.amount')}
        value={grams}
        step={grams >= 100 ? 10 : 5}
        min={0}
        max={5000}
        unit={t(`nutrition.unitShort.${food.unit}`)}
        onChange={setGrams}
      />
      <p class="sheet-note num">
        {t('nutrition.kcalValue', { n: fmtKcal(m.kcal * k) })} · {macroLine({ kcal: 0, p: m.p * k, f: m.f * k, c: m.c * k })}
      </p>
      {extra}
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={grams <= 0}
          feedback={false}
          onClick={() => {
            haptic('success');
            onSubmit(grams);
            close();
          }}
        >
          {submitLabel}
        </Button>
      </SheetActions>
    </div>
  );
}

function FoodPicker({ onPick, close, dishes = true }: { onPick: (f: Food) => void; close: () => void; dishes?: boolean }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = activeFoods.value.filter((f) => (dishes || f.kind === 'product') && (!q || f.name.toLowerCase().includes(q)));
  const pick = (f: Food): void => {
    haptic('light');
    close();
    setTimeout(() => onPick(f), 280);
  };
  return (
    <div class="picker">
      <TextField value={query} onValue={setQuery} placeholder={t('nutrition.search')} type="search" />
      {list.length === 0 ? (
        <EmptyState icon="utensils" title={q ? t('common.notFound') : t('nutrition.noFoods')} />
      ) : (
        <List>
          {list.map((f) => (
            <ListRow key={f.id} {...(f.kind === 'dish' ? { icon: 'utensils' as const } : {})} title={f.name} subtitle={foodSubtitle(f)} onClick={() => pick(f)} />
          ))}
        </List>
      )}
      <Button block icon="plus" onClick={() => openFoodForm(null, query.trim(), (f) => pick(f))}>
        {query.trim() ? t('nutrition.createNamed', { name: query.trim() }) : t('nutrition.newProduct')}
      </Button>
    </div>
  );
}

export function openFoodPicker(onPick: (f: Food) => void, opts: { dishes?: boolean } = {}): void {
  void openSheet((close) => <FoodPicker onPick={onPick} close={close} dishes={opts.dishes ?? true} />, {
    title: t('nutrition.pickFood'),
    fullscreen: true,
  });
}
