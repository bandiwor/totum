import type { FeatureDef } from '@/core/registry';
import { todayFeature } from '@/features/today';
import { planFeature } from '@/features/plan';
import { healthFeature } from '@/features/health';
import { moneyFeature } from '@/features/money';
import { notesFeature } from '@/features/notes';
import { placesFeature } from '@/features/places';
import { quickFeature } from '@/features/quick';
import { settingsFeature } from '@/features/settings';

/** The only place that lists sections. Order of tabs comes from each tab's `order`. */
export const FEATURES: readonly FeatureDef[] = [
  todayFeature,
  planFeature,
  healthFeature,
  moneyFeature,
  notesFeature,
  placesFeature,
  quickFeature,
  settingsFeature,
];
