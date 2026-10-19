import type { FeatureDef } from '@/core/registry';
import { today } from '@/core/date';
import { overdueTasks, tasksOn } from './model';
import { openTaskForm, TaskForm } from './TaskForm';
import { TasksWidget } from './TasksWidget';

export const tasksFeature: FeatureDef = {
  id: 'tasks',
  todayWidgets: [{ id: 'tasks', order: 10, component: TasksWidget }],
  agendaSources: [
    {
      id: 'tasks',
      itemsFor: (date) =>
        [...(date === today() ? overdueTasks(date) : []), ...tasksOn(date)].map((t) => ({
          id: t.id,
          source: 'tasks',
          title: t.title,
          time: t.time,
          done: t.done,
        })),
    },
  ],
  dayActions: [{ id: 'task', label: 'Задача', icon: 'tasks', order: 0, run: (date) => openTaskForm({ preset: { date } }) }],
  quickActions: [
    {
      id: 'task',
      label: 'Задача',
      icon: 'tasks',
      order: 20,
      hint: () => {
        const left = tasksOn(today()).filter((t) => !t.done).length + overdueTasks().length;
        return left ? `осталось ${left}` : null;
      },
      screen: ({ close }) => <TaskForm close={close} />,
    },
  ],
};
