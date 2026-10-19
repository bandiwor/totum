import { signal } from '@preact/signals';
import type { FeatureDef } from '@/core/registry';
import { comingSoon } from '@/features/quick/ComingSoon';
import { TrainingView } from '@/features/training/TrainingView';
import { EmptyState, Page, SegmentedControl } from '@/ui';
import { t } from '@/core/i18n';

type Tab = 'training' | 'food' | 'body';
const tab = signal<Tab>('training');
const TABS: readonly Tab[] = ['training', 'food', 'body'];

function HealthScreen() {
  return (
    <Page title={t('app.tabs.health')} large toolbar={<SegmentedControl options={TABS.map((value) => ({ value, label: t(`stubs.health.tabs.${value}`) }))} value={tab.value} onChange={(v) => (tab.value = v)} />}>
      {tab.value === 'training' && <TrainingView />}
      {tab.value === 'food' && <EmptyState icon="utensils" title={t('common.stage', { n: 4 })} text={t('stubs.health.foodText')} />}
      {tab.value === 'body' && <EmptyState icon="scale" title={t('common.stage', { n: 4 })} text={t('stubs.health.bodyText')} />}
    </Page>
  );
}

export const healthFeature: FeatureDef = {
  id: 'health',
  tab: { path: 'health', label: 'app.tabs.health', icon: 'health', order: 20 },
  routes: [{ pattern: 'health', component: HealthScreen }],
  quickActions: [
    { id: 'food', label: 'stubs.health.food', icon: 'utensils', order: 10, screen: comingSoon(4) },
    { id: 'intake', label: 'stubs.health.intake', icon: 'droplet', order: 11, screen: comingSoon(4) },
    { id: 'weight', label: 'stubs.health.weight', icon: 'scale', order: 40, screen: comingSoon(4) },
  ],
};
