import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { addDays, compareDates, formatDayMonth, formatMonth, formatRelativeDay, today, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { navigate } from '@/core/router';
import { BarChart, Button, Card, ChoiceChips, colorVar, EmptyState, Form, Icon, List, ListRow, openSheet, ProgressBar, Section, SheetActions, Stat } from '@/ui';
import { monthEnd, monthOf, monthStart, monthTotals, shiftMonth, type MonthKey } from './logic';
import { moneyCategories, transactions, type Transaction } from './model';
import { AmountField, openTransactionForm } from './TransactionForm';
import { categoryName, currentBalance, endOfMonthForecast, fmtMoney, jobIncome, reserved, setActualBalance, settle, upcoming } from './state';

export const month = signal<MonthKey>(monthOf(today()));

export function MonthNav() {
  const m = month.value;
  const current = monthOf(today());
  const label = formatMonth(monthStart(m)) + (m.slice(0, 4) !== current.slice(0, 4) ? ` ${m.slice(0, 4)}` : '');
  const go = (n: number): void => {
    haptic('selection');
    month.value = shiftMonth(m, n);
  };
  return (
    <div class="month-nav">
      <button type="button" class="ui-strip__nav" aria-label={t('time.prevWeek')} onClick={() => go(-1)}>
        <Icon name="chevronLeft" size={18} />
      </button>
      <span class="month-nav__label">{label}</span>
      {m !== current && (
        <button type="button" class="ui-strip__today" onClick={() => (month.value = current)}>
          {t('time.now')}
        </button>
      )}
      <button type="button" class="ui-strip__nav" aria-label={t('time.nextWeek')} onClick={() => go(1)}>
        <Icon name="chevronRight" size={18} />
      </button>
    </div>
  );
}

function BalanceForm({ close }: { close: () => void }) {
  const [value, setValue] = useState(Math.round(currentBalance.value));
  return (
    <Form>
      <AmountField value={value} onChange={setValue} autoFocus />
      <p class="sheet-note">{t('money.setBalanceHint')}</p>
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => {
            setActualBalance(value);
            close();
          }}
        >
          {t('common.save')}
        </Button>
      </SheetActions>
    </Form>
  );
}

function pctDelta(cur: number, prev: number): { text: string; direction: 'up' | 'down' | 'flat' } | undefined {
  if (prev <= 0) return undefined;
  const pct = ((cur - prev) / prev) * 100;
  return { text: t('money.vsPrev', { pct: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}` }), direction: Math.abs(pct) < 1 ? 'flat' : pct > 0 ? 'up' : 'down' };
}

/** "Завтра" / "28 октября". */
const shortDay = (d: ISODate): string => {
  const rel = formatRelativeDay(d);
  return rel.includes(',') ? formatDayMonth(d) : rel;
};

function UpcomingList() {
  const now = today();
  const list = upcoming(now, addDays(now, 14));
  if (list.length === 0) return <p class="widget-empty">{t('money.noUpcoming')}</p>;
  return (
    <List>
      {list.map((u) => {
        const overdue = compareDates(u.date, now) < 0;
        return (
          <ListRow
            key={u.key}
            leading={<span class="color-dot" style={{ background: colorVar(moneyCategories.get(u.categoryId ?? '')?.color ?? 'c8') }} />}
            title={u.name}
            subtitle={
              <span class={overdue ? 'task--overdue' : undefined}>
                {t('money.upcomingLine', { date: overdue ? t('money.overdue') : shortDay(u.date), amount: fmtMoney(u.type === 'income' ? u.amount : -u.amount, true) })}
              </span>
            }
            trailing={
              <Button
                size="sm"
                feedback="success"
                onClick={() => settle(u)}
              >
                {u.source.kind === 'planned' ? t('money.conduct') : u.type === 'income' ? t('money.received') : t('money.paid')}
              </Button>
            }
          />
        );
      })}
    </List>
  );
}

export function Overview() {
  const m = month.value;
  const totals = monthTotals(transactions.all.value, m);
  const prev = monthTotals(transactions.all.value, shiftMonth(m, -1));
  const net = totals.income - totals.expense;
  const cats = [...totals.byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const maxCat = cats[0]?.[1] ?? 0;
  const history = Array.from({ length: 6 }, (_, i) => shiftMonth(m, i - 5)).map((mm) => ({
    key: mm,
    label: formatMonth(monthStart(mm)).slice(0, 3),
    value: monthTotals(transactions.all.value, mm).expense,
  }));
  const isCurrent = m === monthOf(today());
  const work = jobIncome(m);

  return (
    <>
      <Card>
        <div class="money-balance">
          <div>
            <p class="ui-stat__label">{t('money.balance')}</p>
            <p class="money-balance__value num">{fmtMoney(currentBalance.value)}</p>
          </div>
          <Button size="sm" variant="ghost" icon="pencil" onClick={() => void openSheet((close) => <BalanceForm close={close} />, { title: t('money.setBalance') })} />
        </div>
        {reserved.value > 0 && (
          <p class="money-balance__sub num">
            {t('money.reserved')}: {fmtMoney(reserved.value)} · {t('money.free')}: {fmtMoney(currentBalance.value - reserved.value)}
          </p>
        )}
      </Card>

      <Section>
        <MonthNav />
        <div class="stat-grid stat-grid--3 money-stats">
          <Card>
            <Stat label={t('money.income')} value={fmtMoney(totals.income)} />
          </Card>
          <Card>
            <Stat label={t('money.expense')} value={fmtMoney(totals.expense)} {...(pctDelta(totals.expense, prev.expense) ? { delta: pctDelta(totals.expense, prev.expense)!, deltaGood: 'down' as const } : {})} />
          </Card>
          <Card>
            <Stat label={t('money.net')} value={fmtMoney(net, true)} />
          </Card>
        </div>
        {isCurrent && (
          <Card>
            <Stat label={t('money.endOfMonth')} value={fmtMoney(endOfMonthForecast(m))} />
            <p class="macro__hint">{t('money.endOfMonthHint')}</p>
          </Card>
        )}
      </Section>

      {isCurrent && (
        <Section title={t('money.upcoming')}>
          <UpcomingList />
        </Section>
      )}

      {work.length > 0 && (
        <Section title={t('money.work')}>
          <List>
            {work.map((w) => (
              <ListRow
                key={w.jobId}
                icon="briefcase"
                title={w.name}
                subtitle={t('money.workLine', { expected: fmtMoney(w.expected), received: fmtMoney(w.received) })}
                trailing={
                  w.expected > w.received ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        openTransactionForm({
                          preset: { type: 'income', amount: Math.round(w.expected - w.received), jobId: w.jobId, note: w.name, date: compareDates(monthEnd(m), today()) < 0 ? monthEnd(m) : today() },
                        })
                      }
                    >
                      {t('money.receive')}
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </List>
        </Section>
      )}

      <Section title={t('money.byCategory')}>
        {cats.length === 0 ? (
          <p class="widget-empty">{t('money.noExpenses')}</p>
        ) : (
          <Card padded={false}>
            {cats.map(([id, amount]) => (
              <div key={id ?? 'none'} class="cat-row">
                <div class="cat-row__head">
                  <span class="color-dot" style={{ background: colorVar(moneyCategories.get(id ?? '')?.color ?? 'c8') }} />
                  <span class="cat-row__name">{categoryName(id)}</span>
                  <span class="cat-row__pct num">{Math.round((amount / totals.expense) * 100)}%</span>
                  <span class="num">{fmtMoney(amount)}</span>
                </div>
                <ProgressBar value={amount} max={maxCat} color={colorVar(moneyCategories.get(id ?? '')?.color ?? 'c8')} />
              </div>
            ))}
          </Card>
        )}
      </Section>

      <Section title={t('money.sixMonths')}>
        <Card>
          <BarChart bars={history} format={(v) => fmtMoney(v)} />
        </Card>
        <p class="settings__note">{t('money.sixMonthsHint')}</p>
      </Section>

      <Section>
        <List>
          <ListRow icon="refresh" title={t('money.recurring')} subtitle={t('money.recurringSub')} chevron onClick={() => navigate('money/recurring')} />
          <ListRow icon="tasks" title={t('money.categories')} subtitle={t('money.categoriesSub')} chevron onClick={() => navigate('money/categories')} />
        </List>
      </Section>
    </>
  );
}

type Filter = 'all' | 'expense' | 'income';
const filter = signal<Filter>('all');

function TxRow({ tx }: { tx: Transaction }) {
  const cat = tx.categoryId ? moneyCategories.get(tx.categoryId) : undefined;
  return (
    <ListRow
      leading={<span class="color-dot" style={{ background: colorVar(cat?.color ?? 'c8') }} />}
      title={tx.note || categoryName(tx.categoryId)}
      subtitle={[tx.note && tx.note !== categoryName(tx.categoryId) ? categoryName(tx.categoryId) : null, tx.spreadMonths > 1 ? t('money.spreadBadge', { n: tx.spreadMonths }) : null].filter(Boolean).join(' · ') || undefined}
      value={fmtMoney(tx.type === 'income' ? tx.amount : -tx.amount, true)}
      onClick={() => openTransactionForm({ tx })}
    />
  );
}

export function Operations() {
  const m = month.value;
  const f = filter.value;
  const from = monthStart(m);
  const to = monthEnd(m);
  const list = transactions.all.value
    .filter((tx) => (f === 'all' || tx.type === f) && compareDates(tx.date, from) >= 0 && compareDates(tx.date, to) <= 0)
    .sort((a, b) => compareDates(b.date, a.date) || b.createdAt - a.createdAt);
  const planned = list.filter((tx) => tx.status === 'planned');
  const done = list.filter((tx) => tx.status === 'done');
  const byDate = new Map<ISODate, Transaction[]>();
  for (const tx of done) {
    const arr = byDate.get(tx.date) ?? [];
    arr.push(tx);
    byDate.set(tx.date, arr);
  }

  return (
    <>
      <MonthNav />
      <div class="tasks__filters" style={{ marginTop: 'var(--space-3)' }}>
        <ChoiceChips options={(['all', 'expense', 'income'] as const).map((value) => ({ value, label: t(`money.filters.${value}`) }))} value={f} onChange={(v) => v && (filter.value = v)} />
      </div>
      {list.length === 0 ? (
        <EmptyState
          icon="coins"
          title={t('money.noOps')}
          text={t('money.noOpsText')}
          action={<Button variant="primary" icon="plus" onClick={() => openTransactionForm()}>{t('money.newExpense')}</Button>}
        />
      ) : (
        <>
          {planned.length > 0 && (
            <Section title={t('money.planned')}>
              <List>
                {planned.map((tx) => (
                  <TxRow key={tx.id} tx={tx} />
                ))}
              </List>
            </Section>
          )}
          {[...byDate.entries()].map(([date, items]) => (
            <Section key={date} title={formatRelativeDay(date)}>
              <List>
                {items.map((tx) => (
                  <TxRow key={tx.id} tx={tx} />
                ))}
              </List>
            </Section>
          ))}
        </>
      )}
    </>
  );
}

