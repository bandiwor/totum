import type { FeatureDef } from '@/core/registry';
import { TodayScreen } from './TodayScreen';

export const todayFeature: FeatureDef = {
  id: 'today',
  tab: { path: 'today', label: 'app.tabs.today', icon: 'today', order: 0 },
  routes: [{ pattern: 'today', component: TodayScreen }],
};
