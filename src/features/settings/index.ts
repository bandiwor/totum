import type { FeatureDef } from '@/core/registry';
import { SettingsScreen } from './SettingsScreen';

export const settingsFeature: FeatureDef = {
  id: 'settings',
  routes: [{ pattern: 'settings', component: SettingsScreen }],
};
