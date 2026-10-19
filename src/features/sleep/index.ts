import type { FeatureDef } from '@/core/registry';
import { QuickSleep, sleepHint, sleepRelevance, SleepWidget } from './SleepView';

export const sleepFeature: FeatureDef = {
  id: 'sleep',
  module: 'sleep',
  todayWidgets: [{ id: 'sleep', order: 5, component: SleepWidget }],
  quickActions: [{ id: 'sleep', label: 'sleep.title', icon: 'moon', order: 45, hint: sleepHint, relevance: sleepRelevance, screen: QuickSleep }],
};
