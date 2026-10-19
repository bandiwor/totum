import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { newId } from '@/core/id';
import type { RouteProps } from '@/core/registry';
import { navigate } from '@/core/router';
import {
  Button,
  Card,
  ChoiceChips,
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
  SegmentedControl,
  SheetActions,
  Switch,
  TextField,
} from '@/ui';
import { fmtAmount, fmtG, fmtKcal } from './actions';
import { AmountForm, foodSubtitle, openFoodPicker } from './components';
import { foodLog, foods, macrosOf, mealPlan, per100, type Food, type FoodUnit, type Macros, type Portion } from './model';

const UNITS: readonly FoodUnit[] = ['g', 'ml'];

function isUsed(id: string): boolean {
  const inPlan = mealPlan.value.value.cycle?.days.some((d) => d.some((m) => m.items.some((i) => i.foodId === id))) ?? false;
  const inDish = foods.all.value.some((f) => f.ingredients.some((i) => i.foodId === id));
  return inPlan || inDish || foodLog.all.value.some((e) => e.foodId === id);
}

/** Numeric text input that accepts "12,5". */
function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(value ? String(value) : '');
  return (
    <TextField
      label={label}
      value={text}
      inputMode="decimal"
      onValue={(v) => {
        setText(v);
        const n = Number(v.replace(',', '.'));
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

function PortionsEditor({ portions, unit, onChange }: { portions: Portion[]; unit: FoodUnit; onChange: (p: Portion[]) => void }) {
  const add = (): void =>
    void openSheet(
      (close) => <PortionForm unit={unit} onSave={(p) => onChange([...portions, p])} close={close} />,
      { title: t('nutrition.portionName') },
    );
  return (
    <Field label={t('nutrition.portions')} hint={t('nutrition.portionsHint')}>
      {portions.length > 0 && (
        <List>
          {portions.map((p) => (
            <ListRow
              key={p.id}
              title={t('nutrition.portionLine', { name: p.name, grams: `${fmtG(p.grams)} ${t(`nutrition.unitShort.${unit}`)}` })}
              trailing={<IconButton icon="x" label={t('common.delete')} onClick={() => onChange(portions.filter((x) => x.id !== p.id))} />}
            />
          ))}
        </List>
      )}
      <Button size="sm" variant="ghost" icon="plus" onClick={add}>
        {t('nutrition.addPortion')}
      </Button>
    </Field>
  );
}

function PortionForm({ unit, onSave, close }: { unit: FoodUnit; onSave: (p: Portion) => void; close: () => void }) {
  const [name, setName] = useState('');
  const [grams, setGrams] = useState(50);
  return (
    <Form>
      <TextField label={t('nutrition.portionName')} value={name} onValue={setName} placeholder={t('nutrition.portionNamePlaceholder')} autoFocus />
      <NumberStepper value={grams} step={5} min={1} max={2000} unit={t(`nutrition.unitShort.${unit}`)} onChange={setGrams} />
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!name.trim()}
          onClick={() => {
            onSave({ id: newId(), name: name.trim(), grams });
            close();
          }}
        >
          {t('common.add')}
        </Button>
      </SheetActions>
    </Form>
  );
}

function FoodForm({ food, initialName, onCreated, close }: { food: Food | null; initialName: string; onCreated?: (f: Food) => void; close: () => void }) {
  const [name, setName] = useState(food?.name ?? initialName);
  const [isDish, setIsDish] = useState(food?.kind === 'dish');
  const [unit, setUnit] = useState<FoodUnit>(food?.unit ?? 'g');
  const [m, setM] = useState<Macros>(food?.per100 ?? { kcal: 0, p: 0, f: 0, c: 0 });
  const [portions, setPortions] = useState<Portion[]>(food?.portions ?? []);
  const [archived, setArchived] = useState(food?.archived ?? false);
  const byMacros = 4 * m.p + 9 * m.f + 4 * m.c;
  const mismatch = !isDish && m.kcal > 0 && byMacros > 0 && Math.abs(byMacros - m.kcal) / m.kcal > 0.15;

  const save = (): void => {
    const data = { name: name.trim(), unit, portions, archived };
    if (!data.name) return;
    if (food) {
      foods.update(food.id, food.kind === 'product' ? { ...data, per100: m } : data);
    } else {
      const created = foods.add({ ...data, kind: isDish ? 'dish' : 'product', per100: isDish ? { kcal: 0, p: 0, f: 0, c: 0 } : m, ingredients: [], cookedWeight: null });
      if (isDish) {
        close();
        navigate(`health/food/${created.id}`);
        return;
      }
      onCreated?.(created);
    }
    haptic('success');
    close();
  };

  return (
    <Form>
      <TextField label={t('common.name')} value={name} onValue={setName} autoFocus={!food} />
      {!food && (
        <List>
          <ListRow title={t('nutrition.dish')} subtitle={t('nutrition.ingredients')} trailing={<Switch label={t('nutrition.dish')} checked={isDish} onChange={setIsDish} />} />
        </List>
      )}
      <Field label={t('nutrition.unit')}>
        <ChoiceChips options={UNITS.map((u) => ({ value: u, label: t(`nutrition.units.${u}`) }))} value={unit} onChange={(u) => u && setUnit(u)} />
      </Field>
      {!isDish && (
        <Field label={t('nutrition.per100', { unit: t(`nutrition.unitShort.${unit}`) })}>
          <div class="ui-row2">
            <NumField label={t('nutrition.kcal')} value={m.kcal} onChange={(kcal) => setM({ ...m, kcal })} />
            <NumField label={t('nutrition.protein')} value={m.p} onChange={(p) => setM({ ...m, p })} />
            <NumField label={t('nutrition.fat')} value={m.f} onChange={(f) => setM({ ...m, f })} />
            <NumField label={t('nutrition.carbs')} value={m.c} onChange={(c) => setM({ ...m, c })} />
          </div>
          {mismatch && <span class="ui-field__hint">{t('nutrition.kcalCheck', { kcal: fmtKcal(byMacros) })}</span>}
        </Field>
      )}
      <PortionsEditor portions={portions} unit={unit} onChange={setPortions} />
      {food && (
        <List>
          <ListRow title={t('common.archived')} trailing={<Switch label={t('common.archive')} checked={archived} onChange={setArchived} />} />
        </List>
      )}
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!name.trim()} feedback={false} onClick={save}>
          {t('common.save')}
        </Button>
        {food && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={async () => {
              if (isUsed(food.id)) {
                await confirm({ title: food.name, message: t('nutrition.foodInUse'), confirmLabel: t('common.understood') });
                return;
              }
              if (await confirm({ title: t('schedule.deleteNamed', { name: food.name }), confirmLabel: t('common.delete'), danger: true })) {
                foods.remove(food.id);
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

export function openFoodForm(food: Food | null, initialName = '', onCreated?: (f: Food) => void): void {
  if (food?.kind === 'dish') {
    navigate(`health/food/${food.id}`);
    return;
  }
  void openSheet((close) => <FoodForm food={food} initialName={initialName} close={close} {...(onCreated ? { onCreated } : {})} />, {
    title: food ? food.name : t('nutrition.newProduct'),
  });
}

const kindTab = signal<'product' | 'dish'>('product');

export function FoodsScreen() {
  const list = [...foods.all.value]
    .filter((f) => f.kind === kindTab.value)
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'ru'));
  return (
    <Page title={t('nutrition.foods')} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => openFoodForm(null)} />}>
      <SegmentedControl
        options={[
          { value: 'product', label: t('nutrition.products') },
          { value: 'dish', label: t('nutrition.dishes') },
        ]}
        value={kindTab.value}
        onChange={(v) => (kindTab.value = v)}
      />
      <Section>
        {list.length === 0 ? (
          <EmptyState icon="utensils" title={t('nutrition.noFoods')} text={t('nutrition.noFoodsText')} action={<Button variant="primary" icon="plus" onClick={() => openFoodForm(null)}>{t('common.add')}</Button>} />
        ) : (
          <List>
            {list.map((f) => (
              <ListRow
                key={f.id}
                title={f.archived ? t('common.archivedSuffix', { name: f.name }) : f.name}
                subtitle={foodSubtitle(f)}
                chevron
                onClick={() => openFoodForm(f)}
              />
            ))}
          </List>
        )}
      </Section>
    </Page>
  );
}

export function DishEditor({ params }: RouteProps) {
  const dish = foods.byId(params.id);
  if (!dish || dish.kind !== 'dish') return <Page title={t('nutrition.dish')} back><EmptyState icon="utensils" title={t('common.notFound')} /></Page>;
  const patch = (p: Partial<Food>): void => void foods.update(dish.id, p);
  const rawWeight = dish.ingredients.reduce((s, i) => s + i.grams, 0);
  const m = per100(dish);

  const editIngredient = (index: number): void => {
    const ing = dish.ingredients[index];
    if (!ing) return;
    void openSheet(
      (close) => (
        <AmountForm
          foodId={ing.foodId}
          initial={ing.grams}
          submitLabel={t('common.save')}
          onSubmit={(grams) => patch({ ingredients: dish.ingredients.map((x, i) => (i === index ? { ...x, grams } : x)) })}
          extra={
            <Button variant="danger" block icon="trash" onClick={() => { patch({ ingredients: dish.ingredients.filter((_, i) => i !== index) }); close(); }}>
              {t('common.delete')}
            </Button>
          }
          close={close}
        />
      ),
      { title: foods.get(ing.foodId)?.name ?? '' },
    );
  };

  const addIngredient = (): void =>
    openFoodPicker(
      (f) =>
        void openSheet(
          (close) => (
            <AmountForm foodId={f.id} initial={100} submitLabel={t('common.add')} onSubmit={(grams) => patch({ ingredients: [...(foods.get(dish.id)?.ingredients ?? []), { foodId: f.id, grams }] })} more={addIngredient} close={close} />
          ),
          { title: f.name },
        ),
      { dishes: false },
    );

  return (
    <Page title={dish.name} back>
      <Section>
        <TextField label={t('common.name')} value={dish.name} onValue={(name) => patch({ name })} />
      </Section>
      <Section title={t('nutrition.per100', { unit: t(`nutrition.unitShort.${dish.unit}`) })}>
        <Card>
          <p class="num">{foodSubtitle(dish)}</p>
        </Card>
      </Section>
      <Section title={t('nutrition.ingredients')}>
        {dish.ingredients.length > 0 && (
          <List>
            {dish.ingredients.map((ing, i) => {
              const f = foods.get(ing.foodId);
              return (
                <ListRow
                  key={`${ing.foodId}-${i}`}
                  title={f?.name ?? '—'}
                  subtitle={t('nutrition.kcalValue', { n: fmtKcal(macrosOf(ing.foodId, ing.grams).kcal) })}
                  value={fmtAmount(ing.foodId, ing.grams)}
                  onClick={() => editIngredient(i)}
                />
              );
            })}
          </List>
        )}
        <Button block icon="plus" onClick={addIngredient}>
          {t('nutrition.addIngredient')}
        </Button>
      </Section>
      <Section title={t('nutrition.cookedWeight')}>
        <List>
          <ListRow
            title={t('nutrition.useCookedWeight')}
            subtitle={t('nutrition.cookedWeightHint')}
            trailing={<Switch label={t('nutrition.useCookedWeight')} checked={dish.cookedWeight !== null} onChange={(on) => patch({ cookedWeight: on ? Math.round(rawWeight) || 100 : null })} />}
          />
        </List>
        {dish.cookedWeight !== null && (
          <NumberStepper value={dish.cookedWeight} step={10} min={1} max={20000} unit={t(`nutrition.unitShort.${dish.unit}`)} onChange={(cookedWeight) => patch({ cookedWeight })} />
        )}
      </Section>
      <Section>
        <PortionsEditor portions={dish.portions} unit={dish.unit} onChange={(portions) => patch({ portions })} />
      </Section>
      <Section>
        <List>
          <ListRow title={t('common.archived')} trailing={<Switch label={t('common.archive')} checked={dish.archived} onChange={(archived) => patch({ archived })} />} />
        </List>
        <Button
          variant="danger"
          block
          icon="trash"
          onClick={async () => {
            if (isUsed(dish.id)) {
              await confirm({ title: dish.name, message: t('nutrition.foodInUse'), confirmLabel: t('common.understood') });
              return;
            }
            if (await confirm({ title: t('schedule.deleteNamed', { name: dish.name }), confirmLabel: t('common.delete'), danger: true })) {
              foods.remove(dish.id);
              navigate('health/foods', { replace: true });
            }
          }}
        >
          {t('common.delete')}
        </Button>
      </Section>
      {m.kcal === 0 && dish.ingredients.length === 0 && <p class="settings__note">{t('nutrition.noFoodsText')}</p>}
    </Page>
  );
}
