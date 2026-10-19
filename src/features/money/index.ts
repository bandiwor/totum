import { h } from 'preact';
import type { FeatureDef } from '@/core/registry';
import { Placeholder } from '@/app/Placeholder';
import { comingSoon } from '@/features/quick/ComingSoon';

const MoneyScreen = () =>
  h(Placeholder, {
    title: 'Деньги',
    tabs: [
      { value: 'overview', label: 'Обзор', icon: 'wallet', stage: 5, text: 'Баланс, траты по категориям, прогноз накоплений.' },
      { value: 'ops', label: 'Операции', icon: 'coins', stage: 5, text: 'Доходы и траты: разовые, регулярные, растянутые на период.' },
      { value: 'goals', label: 'Цели', icon: 'sparkles', stage: 5, text: 'Сколько накопить к дате и сколько откладывать в месяц.' },
    ],
  });

export const moneyFeature: FeatureDef = {
  id: 'money',
  tab: { path: 'money', label: 'Деньги', icon: 'wallet', order: 30 },
  routes: [{ pattern: 'money', component: MoneyScreen }],
  quickActions: [{ id: 'expense', label: 'Трата', icon: 'coins', order: 30, screen: comingSoon(5) }],
};
