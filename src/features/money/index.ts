import { h } from 'preact';
import { t } from '@/core/i18n';
import type { FeatureDef } from '@/core/registry';
import { Placeholder } from '@/app/Placeholder';
import { comingSoon } from '@/features/quick/ComingSoon';

const MoneyScreen = () =>
  h(Placeholder, {
    title: t('stubs.money.title'),
    tabs: [
      { value: 'overview', label: t('stubs.money.overview'), icon: 'wallet', stage: 5, text: t('stubs.money.overviewText') },
      { value: 'ops', label: t('stubs.money.ops'), icon: 'coins', stage: 5, text: t('stubs.money.opsText') },
      { value: 'goals', label: t('stubs.money.goals'), icon: 'sparkles', stage: 5, text: t('stubs.money.goalsText') },
    ],
  });

export const moneyFeature: FeatureDef = {
  id: 'money',
  tab: { path: 'money', label: 'app.tabs.money', icon: 'wallet', order: 30 },
  routes: [{ pattern: 'money', component: MoneyScreen }],
  quickActions: [{ id: 'expense', label: 'stubs.money.expense', icon: 'coins', order: 30, screen: comingSoon(5) }],
};
