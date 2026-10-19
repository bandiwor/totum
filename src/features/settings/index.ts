import type { FeatureDef } from '@/core/registry';
import { LanguageScreen } from './LanguageScreen';
import { ModulesScreen } from './ModulesScreen';
import { PacksScreen } from './PacksScreen';
import { SettingsScreen } from './SettingsScreen';

export const settingsFeature: FeatureDef = {
  id: 'settings',
  routes: [
    { pattern: 'settings', component: SettingsScreen },
    { pattern: 'settings/modules', component: ModulesScreen },
    { pattern: 'settings/language', component: LanguageScreen },
    { pattern: 'settings/packs', component: PacksScreen },
  ],
};
