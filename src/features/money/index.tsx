import { signal } from '@preact/signals';
import { today } from '@/core/date';
import { t } from '@/core/i18n';
import type { FeatureDef } from '@/core/registry';
import { IconButton, Page, SegmentedControl } from '@/ui';
import { GoalsView } from './GoalsView';
import { monthOf, monthTotals } from './logic';
import { transactions } from './model';
import { Operations, Overview } from './MoneyViews';
import { CategoriesScreen, RecurringScreen } from './SetupScreens';
import { fmtMoney, seedMoney, upcoming } from './state';
import { openTransactionForm, TransactionForm } from './TransactionForm';

type Tab = 'overview' | 'ops' | 'goals';
const tab = signal<Tab>('overview');
const TABS: readonly Tab[] = ['overview', 'ops', 'goals'];

function MoneyScreen() {
  return (
    <Page
      title={t('money.title')}
      large
      scrollKey={tab.value}
      actions={<IconButton icon="plus" label={t('money.newExpense')} variant="accent" onClick={() => openTransactionForm()} />}
      toolbar={<SegmentedControl options={TABS.map((value) => ({ value, label: t(`money.tabs.${value}`) }))} value={tab.value} onChange={(v) => (tab.value = v)} />}
    >
      {tab.value === 'overview' && <Overview />}
      {tab.value === 'ops' && <Operations />}
      {tab.value === 'goals' && <GoalsView />}
    </Page>
  );
}

export const moneyFeature: FeatureDef = {
  id: 'money',
  tab: { path: 'money', label: 'app.tabs.money', icon: 'wallet', order: 30 },
  routes: [
    { pattern: 'money', component: MoneyScreen },
    { pattern: 'money/recurring', component: RecurringScreen },
    { pattern: 'money/categories', component: CategoriesScreen },
  ],
  quickActions: [
    {
      id: 'expense',
      label: 'money.quickExpense',
      icon: 'coins',
      order: 30,
      hint: () => t('money.monthSpent', { amount: fmtMoney(monthTotals(transactions.all.value, monthOf(today())).expense) }),
      screen: ({ close }) => <TransactionForm close={close} />,
    },
  ],
  agendaSources: [
    {
      id: 'money',
      itemsFor: (date) =>
        date === today()
          ? upcoming(date, date).map((u) => ({
              id: u.key,
              source: 'money',
              title: t('money.dueToday', { name: u.name, amount: fmtMoney(u.amount) }),
              time: null,
              done: false,
            }))
          : [],
    },
  ],
  onReady: seedMoney,
};
