import { t } from '@/core/i18n';
import type { FeatureDef } from '@/core/registry';
import { BodyView } from '@/features/nutrition/BodyView';
import { healthTab, type HealthTab } from '@/features/nutrition/healthTab';
import { NutritionView } from '@/features/nutrition/NutritionView';
import { TrainingView } from '@/features/training/TrainingView';
import { Page, SegmentedControl } from '@/ui';

const TABS: readonly HealthTab[] = ['training', 'food', 'body'];

function HealthScreen() {
  return (
    <Page
      title={t('app.tabs.health')}
      large
      scrollKey={healthTab.value}
      toolbar={<SegmentedControl options={TABS.map((value) => ({ value, label: t(`nutrition.tabs.${value}`) }))} value={healthTab.value} onChange={(v) => (healthTab.value = v)} />}
    >
      {healthTab.value === 'training' && <TrainingView />}
      {healthTab.value === 'food' && <NutritionView />}
      {healthTab.value === 'body' && <BodyView />}
    </Page>
  );
}

/** The Health tab hosts Training and Nutrition/Body; each feature registers its own routes and actions. */
export const healthFeature: FeatureDef = {
  id: 'health',
  tab: { path: 'health', label: 'app.tabs.health', icon: 'health', order: 20 },
  routes: [{ pattern: 'health', component: HealthScreen }],
};
