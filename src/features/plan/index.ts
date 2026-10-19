import type { FeatureDef } from '@/core/registry';
import { PlanScreen, SetupScreen } from './PlanScreen';

export const planFeature: FeatureDef = {
  id: 'plan',
  tab: { path: 'plan', label: 'План', icon: 'calendar', order: 10 },
  routes: [
    { pattern: 'plan', component: PlanScreen },
    { pattern: 'plan/setup', component: SetupScreen },
  ],
};
