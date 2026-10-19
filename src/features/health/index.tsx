import { t } from '@/core/i18n';
import { moduleVisible, type ModuleSpec } from '@/core/modules';
import type { FeatureDef } from '@/core/registry';
import { BodyView } from '@/features/nutrition/BodyView';
import { healthTab, type HealthTab } from '@/features/nutrition/healthTab';
import { NutritionView } from '@/features/nutrition/NutritionView';
import { SleepView } from '@/features/sleep/SleepView';
import { TrainingView } from '@/features/training/TrainingView';
import { Page, SegmentedControl, type IconName } from '@/ui';

/** Segments of the Health tab and the modules that keep each one visible. */
const SEGMENTS: readonly { id: HealthTab; icon: IconName; module: ModuleSpec }[] = [
  { id: 'training', icon: 'dumbbell', module: 'training' },
  { id: 'food', icon: 'apple', module: ['nutrition', 'water', 'intake'] },
  { id: 'body', icon: 'bodyScale', module: 'body' },
  { id: 'sleep', icon: 'moon', module: 'sleep' },
];

function HealthScreen() {
  const visible = SEGMENTS.filter((s) => moduleVisible(s.module));
  const current = visible.find((s) => s.id === healthTab.value)?.id ?? visible[0]?.id ?? 'training';
  return (
    <Page
      title={t('app.tabs.health')}
      large
      scrollKey={current}
      toolbar={
        visible.length > 1 ? (
          <SegmentedControl options={visible.map((s) => ({ value: s.id, label: t(`nutrition.tabs.${s.id}`), icon: s.icon }))} value={current} onChange={(v) => (healthTab.value = v)} />
        ) : undefined
      }
    >
      {current === 'training' && <TrainingView />}
      {current === 'food' && <NutritionView />}
      {current === 'body' && <BodyView />}
      {current === 'sleep' && <SleepView />}
    </Page>
  );
}

/** The Health tab hosts Training, Nutrition/Body and Sleep; each feature registers its own routes and actions. */
export const healthFeature: FeatureDef = {
  id: 'health',
  tab: { path: 'health', label: 'app.tabs.health', icon: 'health', order: 20, module: SEGMENTS.flatMap((s) => (typeof s.module === 'string' ? [s.module] : s.module)) },
  routes: [{ pattern: 'health', component: HealthScreen }],
};
