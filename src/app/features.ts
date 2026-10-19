import type { FeatureDef } from '@/core/registry';
import { todayFeature } from '@/features/today';
import { planFeature } from '@/features/plan';
import { healthFeature } from '@/features/health';
import { moneyFeature } from '@/features/money';
import { notesFeature } from '@/features/notes';
import { placesFeature } from '@/features/places';
import { scheduleFeature } from '@/features/schedule';
import { tasksFeature } from '@/features/tasks';
import { workFeature } from '@/features/work';
import { trainingFeature } from '@/features/training';
import { nutritionFeature } from '@/features/nutrition';
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
  scheduleFeature,
  tasksFeature,
  workFeature,
  trainingFeature,
  nutritionFeature,
  quickFeature,
  settingsFeature,
];
