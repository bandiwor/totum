import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { addDays, formatDayMonth, today, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import {
  Button,
  ChoiceChips,
  ColorPicker,
  colorVar,
  confirm,
  DateField,
  EmptyState,
  Field,
  Form,
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
  type ColorKey,
} from '@/ui';
import { occurrences } from './logic';
import { moneyCategories, recurring, sortedMoneyCategories, transactions, type FlowType, type MoneyCategory, type Period, type Recurring } from './model';
import { AmountField } from './TransactionForm';
import { fmtMoney } from './state';

const PERIODS: readonly Period[] = ['month', 'week', 'days'];

function scheduleLine(r: Recurring): string {
  if (r.every === 1 && r.period === 'month') return t('money.monthly');
  if (r.every === 1 && r.period === 'week') return t('money.weekly');
  return t(`money.everyLine.${r.period}`, { n: r.every });
}

function RecurringForm({ rule, close }: { rule: Recurring | null; close: () => void }) {
  const [d, setD] = useState({
    name: rule?.name ?? '',
    type: rule?.type ?? ('expense' as FlowType),
    amount: rule?.amount ?? 0,
    categoryId: rule?.categoryId ?? null,
    period: rule?.period ?? ('month' as Period),
    every: rule?.every ?? 1,
    anchor: rule?.anchor ?? today(),
    endDate: rule?.endDate ?? null,
    active: rule?.active ?? true,
  });
  const patch = (p: Partial<typeof d>): void => setD((cur) => ({ ...cur, ...p }));
  return (
    <Form>
      <SegmentedControl options={(['expense', 'income'] as const).map((value) => ({ value, label: t(`money.types.${value}`) }))} value={d.type} onChange={(type) => patch({ type, categoryId: null })} />
      <TextField label={t('common.name')} value={d.name} onValue={(name) => patch({ name })} autoFocus={!rule} />
      <AmountField value={d.amount} onChange={(amount) => patch({ amount })} />
      <Field label={t('money.category')}>
        <ChoiceChips
          allowNone
          options={sortedMoneyCategories.value.filter((c) => c.type === d.type).map((c) => ({ value: c.id, label: c.name, color: colorVar(c.color) }))}
          value={d.categoryId}
          onChange={(categoryId) => patch({ categoryId })}
        />
      </Field>
      <ChoiceChips options={PERIODS.map((p) => ({ value: p, label: t(`money.periods.${p}`) }))} value={d.period} onChange={(period) => period && patch({ period })} />
      <NumberStepper label={t(`money.every.${d.period}`)} value={d.every} min={1} max={365} onChange={(every) => patch({ every })} />
      <DateField label={t('money.firstDate')} value={d.anchor} onChange={(anchor) => anchor && patch({ anchor })} />
      <List>
        <ListRow title={t('money.hasEnd')} trailing={<Switch label={t('money.hasEnd')} checked={d.endDate !== null} onChange={(on) => patch({ endDate: on ? addDays(d.anchor, 90) : null })} />} />
        {rule && <ListRow title={t('money.active')} trailing={<Switch label={t('money.active')} checked={d.active} onChange={(active) => patch({ active })} />} />}
      </List>
      {d.endDate !== null && <DateField label={t('money.endDate')} value={d.endDate} onChange={(endDate: ISODate | null) => patch({ endDate })} />}
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!d.name.trim() || d.amount <= 0}
          onClick={() => {
            const data = { ...d, name: d.name.trim() };
            if (rule) recurring.update(rule.id, data);
            else recurring.add(data);
            haptic('success');
            close();
          }}
        >
          {t('common.save')}
        </Button>
        {rule && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={async () => {
              if (await confirm({ title: t('schedule.deleteNamed', { name: rule.name }), confirmLabel: t('common.delete'), danger: true })) {
                recurring.remove(rule.id);
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

const openRecurring = (rule: Recurring | null): void => void openSheet((close) => <RecurringForm rule={rule} close={close} />, { title: rule ? rule.name : t('money.newRecurring') });

export function RecurringScreen() {
  const list = [...recurring.all.value].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'ru'));
  const now = today();
  return (
    <Page title={t('money.recurring')} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => openRecurring(null)} />}>
      {list.length === 0 ? (
        <EmptyState icon="refresh" title={t('money.noRecurring')} action={<Button variant="primary" icon="plus" onClick={() => openRecurring(null)}>{t('common.add')}</Button>} />
      ) : (
        <Section>
          <List>
            {list.map((r) => {
              const next = occurrences(r, now, addDays(now, 400))[0];
              return (
                <ListRow
                  key={r.id}
                  leading={<span class="color-dot" style={{ background: colorVar(moneyCategories.get(r.categoryId ?? '')?.color ?? 'c8'), opacity: r.active ? 1 : 0.4 }} />}
                  title={r.name}
                  subtitle={[scheduleLine(r), next && r.active ? t('money.next', { date: formatDayMonth(next) }) : null].filter(Boolean).join(' · ')}
                  value={fmtMoney(r.type === 'income' ? r.amount : -r.amount, true)}
                  onClick={() => openRecurring(r)}
                />
              );
            })}
          </List>
        </Section>
      )}
    </Page>
  );
}

function CategoryForm({ cat, type, close }: { cat: MoneyCategory | null; type: FlowType; close: () => void }) {
  const [name, setName] = useState(cat?.name ?? '');
  const [color, setColor] = useState<string>(cat?.color ?? 'c8');
  const used = cat ? transactions.all.value.some((tx) => tx.categoryId === cat.id) || recurring.all.value.some((r) => r.categoryId === cat.id) : false;
  return (
    <Form>
      <TextField label={t('common.name')} value={name} onValue={setName} autoFocus={!cat} />
      <ColorPicker value={color} onChange={(c: ColorKey) => setColor(c)} />
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!name.trim()}
          onClick={() => {
            if (cat) moneyCategories.update(cat.id, { name: name.trim(), color });
            else moneyCategories.add({ name: name.trim(), color, type, order: moneyCategories.all.value.length + (type === 'income' ? 100 : 0) });
            close();
          }}
        >
          {t('common.save')}
        </Button>
        {cat && !used && (
          <Button variant="danger" block icon="trash" onClick={() => { moneyCategories.remove(cat.id); close(); }}>
            {t('common.delete')}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

const catType = signal<FlowType>('expense');

export function CategoriesScreen() {
  const type = catType.value;
  const list = sortedMoneyCategories.value.filter((c) => c.type === type);
  const open = (cat: MoneyCategory | null): void => void openSheet((close) => <CategoryForm cat={cat} type={type} close={close} />, { title: cat ? cat.name : t('money.newCategory') });
  return (
    <Page title={t('money.categories')} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => open(null)} />}>
      <SegmentedControl options={(['expense', 'income'] as const).map((value) => ({ value, label: t(`money.filters.${value}`) }))} value={type} onChange={(v) => (catType.value = v)} />
      <Section>
        <List>
          {list.map((c) => (
            <ListRow key={c.id} leading={<span class="color-dot" style={{ background: colorVar(c.color) }} />} title={c.name} chevron onClick={() => open(c)} />
          ))}
        </List>
      </Section>
    </Page>
  );
}
