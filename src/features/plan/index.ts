import { h } from 'preact';
import type { FeatureDef } from '@/core/registry';
import { Placeholder } from '@/app/Placeholder';
import { comingSoon } from '@/features/quick/ComingSoon';

const PlanScreen = () =>
  h(Placeholder, {
    title: 'План',
    tabs: [
      { value: 'week', label: 'Неделя', icon: 'calendar', stage: 2, text: 'Неделя целиком: пары, тренировки, смены, дорога и свободные окна.' },
      { value: 'tasks', label: 'Задачи', icon: 'tasks', stage: 2, text: 'Задачи и ДЗ: сегодня, предстоящие, просроченные, по предметам.' },
      { value: 'schedule', label: 'Расписание', icon: 'clock', stage: 2, text: 'Предметы, сетка звонков, цикл на N дней, места и дорога, работа.' },
    ],
  });

export const planFeature: FeatureDef = {
  id: 'plan',
  tab: { path: 'plan', label: 'План', icon: 'calendar', order: 10 },
  routes: [{ pattern: 'plan', component: PlanScreen }],
  quickActions: [{ id: 'task', label: 'Задача', icon: 'tasks', order: 20, screen: comingSoon(2) }],
};
