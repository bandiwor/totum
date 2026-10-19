import { compareDates, formatRelativeDay, formatTime, today } from '@/core/date';
import { subjects } from '@/features/schedule/model';
import { Badge, Checkbox, colorVar, ListRow } from '@/ui';
import { openTaskForm, toggleTask } from './TaskForm';
import type { Task } from './model';

export function TaskRow({ task, showDate = false }: { task: Task; showDate?: boolean }) {
  const subject = task.subjectId ? subjects.get(task.subjectId) : undefined;
  const overdue = !task.done && task.date !== null && compareDates(task.date, today()) < 0;
  const meta = [
    showDate && task.date ? formatRelativeDay(task.date) : null,
    task.time !== null ? formatTime(task.time) : null,
    task.lesson ? 'к паре' : null,
    task.note || null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListRow
      leading={
        <Checkbox
          checked={task.done}
          label={task.title}
          celebrate="task-done"
          {...(subject ? { color: colorVar(subject.color) } : {})}
          onChange={(v) => toggleTask(task, v)}
        />
      }
      title={<span class={task.done ? 'task--done' : undefined}>{task.title}</span>}
      {...(meta ? { subtitle: <span class={overdue ? 'task--overdue' : undefined}>{meta}</span> } : {})}
      trailing={subject ? <Badge>{subject.name}</Badge> : undefined}
      onClick={() => openTaskForm({ task })}
    />
  );
}
