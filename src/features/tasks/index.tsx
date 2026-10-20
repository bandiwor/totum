import type { FeatureDef } from '@/core/registry';
import { today } from '@/core/date';
import { eventEnd, eventsOn, isEvent, overdueTasks, tasks, tasksOn } from './model';
import { openTaskForm, TaskForm } from './TaskForm';
import { TasksWidget } from './TasksWidget';
import { t } from '@/core/i18n';

export const tasksFeature: FeatureDef = {
  id: 'tasks',
  todayWidgets: [{ id: 'tasks', order: 10, component: TasksWidget }],
  agendaSources: [
    {
      id: 'tasks',
      itemsFor: (date) =>
        // Events are on the timeline already; the agenda lists the rest.
        [...(date === today() ? overdueTasks(date) : []), ...tasksOn(date)].filter((x) => !isEvent(x)).map((t) => ({
          id: t.id,
          source: 'tasks',
          title: t.title,
          time: t.time,
          done: t.done,
        })),
    },
  ],
  busySources: [
    {
      id: 'tasks',
      blocksFor: (date) =>
        eventsOn(date).map((e) => ({
          id: e.id,
          source: 'tasks',
          title: e.title,
          start: e.time ?? 0,
          end: eventEnd(e),
          placeId: e.placeId,
          color: 'var(--accent)',
          ...(e.openEnded ? { endUnknown: true, subtitle: t('tasks.eventOpenEnd') } : e.note ? { subtitle: e.note } : {}),
        })),
      open: (_date, id) => {
        const task = tasks.get(id);
        if (task) openTaskForm({ task });
      },
    },
  ],
  dayActions: [{ id: 'task', label: 'tasks.task', icon: 'tasks', order: 0, run: (date) => openTaskForm({ preset: { date } }) }],
  quickActions: [
    {
      id: 'task',
      label: 'tasks.task',
      icon: 'tasks',
      order: 20,
      hint: () => {
        const left = tasksOn(today()).filter((t) => !t.done).length + overdueTasks().length;
        return left ? t('tasks.left', { count: left }) : null;
      },
      screen: ({ close }) => <TaskForm close={close} />,
    },
  ],
};
