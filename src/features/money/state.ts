import { computed } from '@preact/signals';
import { addDays, compareDates, fromLocalDate, today, type ISODate } from '@/core/date';
import { fx } from '@/core/fx';
import { intlLocale, t } from '@/core/i18n';
import { jobs, shiftsFor } from '@/features/work/model';
import { balance, monthEnd, monthOf, monthStart, monthTotals, occurrences, shiftMonth, type MonthKey } from './logic';
import { goals, goalSaved, moneyCategories, moneySettings, recurring, transactions, type FlowType, type Goal, type Recurring, type Transaction } from './model';

// ── Formatting ─────────────────────────────────────────────────────────────

export function fmtMoney(n: number, signed = false): string {
  const num = new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 0 }).format(Math.abs(Math.round(n)));
  const cur = moneySettings.value.value.currency;
  if (!signed) return t('money.amount', { n: n < 0 ? `−${num}` : num, cur });
  return t('money.signedAmount', { sign: n > 0 ? '+' : n < 0 ? '−' : '', n: num, cur });
}

// ── Balances ───────────────────────────────────────────────────────────────

export const currentBalance = computed(() => balance(moneySettings.value.value.openingBalance, transactions.all.value));
export const reserved = computed(() => goals.all.value.filter((g) => !g.archived).reduce((s, g) => s + goalSaved(g), 0));

export function setActualBalance(actual: number): void {
  const withoutOpening = balance(0, transactions.all.value);
  moneySettings.set({ openingBalance: actual - withoutOpening });
}

/** Average (income − expense) of the last 3 full months, spread-aware. */
export const monthlyPace = computed(() => {
  const current = monthOf(today());
  let sum = 0;
  for (let i = 1; i <= 3; i++) {
    const m = monthTotals(transactions.all.value, shiftMonth(current, -i));
    sum += m.income - m.expense;
  }
  return sum / 3;
});

// ── Expected money ─────────────────────────────────────────────────────────

export interface Upcoming {
  key: string;
  date: ISODate;
  name: string;
  type: FlowType;
  amount: number;
  categoryId: string | null;
  source: { kind: 'recurring'; rule: Recurring } | { kind: 'planned'; tx: Transaction };
}

function settled(ruleId: string, date: ISODate): boolean {
  return transactions.all.value.some((tx) => tx.recurringId === ruleId && tx.date === date);
}

/**
 * Unpaid recurring occurrences and planned transactions up to `to`, including
 * overdue ones from the last 60 days. Occurrences dated before the rule was
 * created are history, not debts.
 */
export function upcoming(from: ISODate, to: ISODate): Upcoming[] {
  const lookback = addDays(from, -60);
  const latest = (a: ISODate, b: ISODate): ISODate => (compareDates(a, b) > 0 ? a : b);
  const fromRules = recurring.all.value
    .filter((r) => r.active)
    .flatMap((rule) =>
      occurrences(rule, latest(lookback, createdOn(rule.createdAt)), to)
        .filter((date) => !settled(rule.id, date))
        .map((date): Upcoming => ({ key: `${rule.id}:${date}`, date, name: rule.name, type: rule.type, amount: rule.amount, categoryId: rule.categoryId, source: { kind: 'recurring', rule } })),
    );
  const planned = transactions.all.value
    .filter((tx) => tx.status === 'planned' && compareDates(tx.date, to) <= 0)
    .map((tx): Upcoming => ({
      key: tx.id,
      date: tx.date,
      name: tx.note || categoryName(tx.categoryId),
      type: tx.type,
      amount: tx.amount,
      categoryId: tx.categoryId,
      source: { kind: 'planned', tx },
    }));
  return [...fromRules, ...planned].sort((a, b) => compareDates(a.date, b.date));
}

const createdOn = (ms: number): ISODate => fromLocalDate(new Date(ms));

export function settle(u: Upcoming): void {
  if (u.source.kind === 'planned') transactions.update(u.source.tx.id, { status: 'done' });
  else
    transactions.add({
      date: u.date,
      type: u.type,
      amount: u.amount,
      categoryId: u.categoryId,
      note: u.name,
      spreadMonths: 1,
      status: 'done',
      recurringId: u.source.rule.id,
      jobId: null,
    });
}

export interface JobIncome {
  jobId: string;
  name: string;
  expected: number;
  received: number;
}

export function jobIncome(month: MonthKey): JobIncome[] {
  const first = monthStart(month);
  const last = monthEnd(month);
  const out = new Map<string, JobIncome>();
  for (const job of jobs.all.value) {
    if (job.archived || job.rate <= 0) continue;
    out.set(job.id, { jobId: job.id, name: job.name, expected: job.payType === 'month' ? job.rate : 0, received: 0 });
  }
  if ([...out.values()].length === 0) return [];
  for (let d = first; compareDates(d, last) <= 0; d = addDays(d, 1)) {
    for (const s of shiftsFor(d)) {
      const row = out.get(s.data.jobId);
      const job = s.job;
      if (!row || !job) continue;
      if (job.payType === 'hour') row.expected += ((s.data.end - s.data.start) / 60) * job.rate;
      if (job.payType === 'shift') row.expected += job.rate;
    }
  }
  for (const tx of transactions.all.value) {
    if (tx.type !== 'income' || tx.status !== 'done' || !tx.jobId || monthOf(tx.date) !== month) continue;
    const row = out.get(tx.jobId);
    if (row) row.received += tx.amount;
  }
  return [...out.values()];
}

/** Balance at month end: current + unpaid expected incomes − unpaid planned expenses. */
export function endOfMonthForecast(month: MonthKey): number {
  const now = today();
  const end = monthEnd(month);
  let b = currentBalance.value;
  for (const u of upcoming(now, end)) b += u.type === 'income' ? u.amount : -u.amount;
  for (const j of jobIncome(month)) b += Math.max(0, j.expected - j.received);
  return b;
}

// ── Goals ──────────────────────────────────────────────────────────────────

export function contribute(goal: Goal, amount: number): void {
  const before = goalSaved(goal);
  goals.update(goal.id, { contributions: [...goal.contributions, { date: today(), amount }] });
  if (before < goal.target && before + amount >= goal.target) fx('savings-goal');
}

// ── Categories ─────────────────────────────────────────────────────────────

export function categoryName(id: string | null): string {
  return (id ? moneyCategories.get(id)?.name : undefined) ?? t('money.noCategory');
}
