import { today, type ISODate } from '@/core/date';
import { Button, List, Section } from '@/ui';
import { overdueTasks, tasksOn } from './model';
import { openTaskForm } from './TaskForm';
import { TaskRow } from './TaskRow';
import { t } from '@/core/i18n';

export function TasksWidget({ date }: { date: ISODate }) {
  const overdue = date === today() ? overdueTasks(date) : [];
  const list = tasksOn(date);
  const done = list.filter((t) => t.done).length;
  return (
    <Section
      title={list.length ? t('tasks.widgetTitle', { done, total: list.length }) : t('tasks.tasks')}
      action={<Button size="sm" variant="ghost" icon="plus" onClick={() => openTaskForm({ preset: { date } })}>{t('tasks.task')}</Button>}
    >
      {overdue.length > 0 && (
        <List>
          {overdue.map((t) => (
            <TaskRow key={t.id} task={t} showDate />
          ))}
        </List>
      )}
      {list.length > 0 ? (
        <List>
          {list.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </List>
      ) : (
        overdue.length === 0 && <p class="widget-empty">{t('tasks.noneForDay')}</p>
      )}
    </Section>
  );
}
