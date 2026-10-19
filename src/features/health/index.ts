import { h } from 'preact';
import type { FeatureDef } from '@/core/registry';
import { Placeholder } from '@/app/Placeholder';
import { comingSoon } from '@/features/quick/ComingSoon';

const HealthScreen = () =>
  h(Placeholder, {
    title: 'Здоровье',
    tabs: [
      { value: 'training', label: 'Тренировки', icon: 'dumbbell', stage: 3, text: 'Программа-цикл, режим тренировки, авто-прогрессия, RPE, графики прогресса.' },
      { value: 'food', label: 'Питание', icon: 'utensils', stage: 4, text: 'Рационы-циклы, план/факт, база продуктов и блюд, нормы КБЖУ, приём и вода.' },
      { value: 'body', label: 'Тело', icon: 'scale', stage: 4, text: 'Рост, вес с трендом, расчёт нормы.' },
    ],
  });

export const healthFeature: FeatureDef = {
  id: 'health',
  tab: { path: 'health', label: 'Здоровье', icon: 'health', order: 20 },
  routes: [{ pattern: 'health', component: HealthScreen }],
  quickActions: [
    { id: 'food', label: 'Еда', icon: 'utensils', order: 10, screen: comingSoon(4) },
    { id: 'intake', label: 'Приём и вода', icon: 'droplet', order: 11, screen: comingSoon(4) },
    { id: 'workout', label: 'Тренировка', icon: 'dumbbell', order: 12, screen: comingSoon(3) },
    { id: 'weight', label: 'Вес', icon: 'scale', order: 40, screen: comingSoon(4) },
  ],
};
