import { signal } from '@preact/signals';
import type { FeatureDef } from '@/core/registry';
import { comingSoon } from '@/features/quick/ComingSoon';
import { TrainingView } from '@/features/training/TrainingView';
import { EmptyState, Page, SegmentedControl } from '@/ui';

type Tab = 'training' | 'food' | 'body';
const tab = signal<Tab>('training');
const TABS = [
  { value: 'training', label: 'Тренировки' },
  { value: 'food', label: 'Питание' },
  { value: 'body', label: 'Тело' },
] as const;

function HealthScreen() {
  return (
    <Page title="Здоровье" large toolbar={<SegmentedControl options={TABS} value={tab.value} onChange={(v) => (tab.value = v)} />}>
      {tab.value === 'training' && <TrainingView />}
      {tab.value === 'food' && <EmptyState icon="utensils" title="Этап 4" text="Рационы-циклы, план/факт, база продуктов и блюд, нормы КБЖУ, приём и вода." />}
      {tab.value === 'body' && <EmptyState icon="scale" title="Этап 4" text="Рост, вес с трендом, расчёт нормы." />}
    </Page>
  );
}

export const healthFeature: FeatureDef = {
  id: 'health',
  tab: { path: 'health', label: 'Здоровье', icon: 'health', order: 20 },
  routes: [{ pattern: 'health', component: HealthScreen }],
  quickActions: [
    { id: 'food', label: 'Еда', icon: 'utensils', order: 10, screen: comingSoon(4) },
    { id: 'intake', label: 'Приём и вода', icon: 'droplet', order: 11, screen: comingSoon(4) },
    { id: 'weight', label: 'Вес', icon: 'scale', order: 40, screen: comingSoon(4) },
  ],
};
