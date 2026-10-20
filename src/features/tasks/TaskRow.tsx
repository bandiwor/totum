import { useRef } from 'preact/hooks';
import { compareDates, formatRelativeDay, formatTime, today } from '@/core/date';
import { fx } from '@/core/fx';
import { haptic } from '@/core/haptics';
import { subjects } from '@/features/schedule/model';
import { Badge, Checkbox, colorVar, ListRow, useLongPress } from '@/ui';
import { openTaskForm, toggleTask } from './TaskForm';
import { eventEnd, isEvent, type Task } from './model';
import { t } from '@/core/i18n';

function timeLabel(task: Task): string | null {
  if (task.time === null) return null;
  if (!isEvent(task)) return formatTime(task.time);
  return t('time.range', { from: formatTime(task.time), to: task.openEnded ? '…' : formatTime(eventEnd(task)) });
}

/** Tap = done / not done; hold = open the task. */
export function TaskRow({ task, showDate = false }: { task: Task; showDate?: boolean }) {
  const subject = task.subjectId ? subjects.get(task.subjectId) : undefined;
  const overdue = !task.done && task.date !== null && compareDates(task.date, today()) < 0;
  const hold = useLongPress(() => openTaskForm({ task }));
  const ref = useRef<HTMLDivElement>(null);
  const meta = [showDate && task.date ? formatRelativeDay(task.date) : null, timeLabel(task), task.lesson ? t('tasks.toLessonShort') : null, task.note || null]
    .filter(Boolean)
    .join(' · ');
  return (
    <div class="task-row" ref={ref} {...hold}>
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
        onClick={() => {
          const done = !task.done;
          const check = ref.current?.querySelector('.ui-check') ?? undefined;
          if (done) {
            haptic('success');
            fx('task-done', check ?? null);
          }
          toggleTask(task, done, check);
        }}
      />
    </div>
  );
}
