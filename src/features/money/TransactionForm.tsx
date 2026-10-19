import { useState } from 'preact/hooks';
import { addDays, compareDates, today, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { Button, ChoiceChips, colorVar, confirm, DateField, Field, Form, List, ListRow, NumberStepper, openSheet, SegmentedControl, SheetActions, Switch, TextField } from '@/ui';
import { sortedMoneyCategories, transactions, type FlowType, type Transaction } from './model';

/** Big numeric input that accepts "1 500,50". */
export function AmountField({ value, onChange, autoFocus = false }: { value: number; onChange: (n: number) => void; autoFocus?: boolean }) {
  const [text, setText] = useState(value ? String(value) : '');
  return (
    <input
      class="money-amount num"
      inputMode="decimal"
      placeholder="0"
      value={text}
      autoFocus={autoFocus}
      onInput={(e) => {
        const raw = e.currentTarget.value;
        setText(raw);
        const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

type Draft = Pick<Transaction, 'type' | 'amount' | 'categoryId' | 'date' | 'note' | 'spreadMonths' | 'status' | 'jobId'>;

export interface TransactionFormProps {
  tx?: Transaction;
  preset?: Partial<Draft>;
  close: () => void;
}

export function TransactionForm({ tx, preset, close }: TransactionFormProps) {
  const now = today();
  const [d, setD] = useState<Draft>({
    type: tx?.type ?? preset?.type ?? 'expense',
    amount: tx?.amount ?? preset?.amount ?? 0,
    categoryId: tx?.categoryId ?? preset?.categoryId ?? null,
    date: tx?.date ?? preset?.date ?? now,
    note: tx?.note ?? preset?.note ?? '',
    spreadMonths: tx?.spreadMonths ?? 1,
    status: tx?.status ?? preset?.status ?? 'done',
    jobId: tx?.jobId ?? preset?.jobId ?? null,
  });
  const patch = (p: Partial<Draft>): void => setD((cur) => ({ ...cur, ...p }));
  const yesterday = addDays(now, -1);
  const dateMode = d.date === now ? 'today' : d.date === yesterday ? 'yesterday' : 'pick';
  const [picking, setPicking] = useState(dateMode === 'pick');
  const cats = sortedMoneyCategories.value.filter((c) => c.type === d.type);

  const save = (): void => {
    if (d.amount <= 0) return;
    const data = { ...d, recurringId: tx?.recurringId ?? null, spreadMonths: d.type === 'income' ? 1 : d.spreadMonths };
    if (tx) transactions.update(tx.id, data);
    else transactions.add(data);
    haptic('success');
    close();
  };

  return (
    <Form>
      <SegmentedControl
        options={(['expense', 'income'] as const).map((value) => ({ value, label: t(`money.types.${value}`) }))}
        value={d.type}
        onChange={(type: FlowType) => patch({ type, categoryId: null })}
      />
      <AmountField value={d.amount} onChange={(amount) => patch({ amount })} autoFocus={!tx} />
      <Field label={t('money.category')}>
        <ChoiceChips allowNone options={cats.map((c) => ({ value: c.id, label: c.name, color: colorVar(c.color) }))} value={d.categoryId} onChange={(categoryId) => patch({ categoryId })} />
      </Field>
      <Field label={t('money.date')}>
        <ChoiceChips
          options={[
            { value: 'today', label: t('money.today') },
            { value: 'yesterday', label: t('money.yesterday') },
            { value: 'pick', label: t('money.pickDate') },
          ]}
          value={picking ? 'pick' : dateMode}
          onChange={(m) => {
            setPicking(m === 'pick');
            if (m === 'today') patch({ date: now, status: 'done' });
            if (m === 'yesterday') patch({ date: yesterday, status: 'done' });
          }}
        />
      </Field>
      {picking && <DateField value={d.date} onChange={(date: ISODate | null) => date && patch({ date, status: compareDates(date, now) > 0 ? 'planned' : d.status })} />}
      <TextField value={d.note} onValue={(note) => patch({ note })} placeholder={t('money.note')} />
      {d.type === 'expense' && (
        <>
          <NumberStepper label={t('money.spread')} value={d.spreadMonths} min={1} max={36} onChange={(spreadMonths) => patch({ spreadMonths })} />
          <p class="sheet-note">{t('money.spreadHint')}</p>
        </>
      )}
      <List>
        <ListRow
          title={t('money.isPlanned')}
          subtitle={t('money.isPlannedHint')}
          trailing={<Switch label={t('money.isPlanned')} checked={d.status === 'planned'} onChange={(on) => patch({ status: on ? 'planned' : 'done' })} />}
        />
      </List>
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={d.amount <= 0} feedback={false} onClick={save}>
          {tx ? t('common.save') : t('common.add')}
        </Button>
        {tx && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={async () => {
              if (await confirm({ title: t('money.deleteTx'), confirmLabel: t('common.delete'), danger: true })) {
                transactions.remove(tx.id);
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

export function openTransactionForm(props: Omit<TransactionFormProps, 'close'> = {}): void {
  const title = props.tx ? t('money.edit') : props.preset?.type === 'income' ? t('money.newIncome') : t('money.newExpense');
  void openSheet((close) => <TransactionForm {...props} close={close} />, { title });
}
