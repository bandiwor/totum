import { signal } from '@preact/signals';
import { compareDates, today } from '@/core/date';
import { activeSubjects } from '@/features/schedule/model';
import { Button, ChoiceChips, colorVar, EmptyState, List, Section } from '@/ui';
import { byDue, openTasks, overdueTasks, tasks } from './model';
import { openTaskForm } from './TaskForm';
import { TaskRow } from './TaskRow';

type Filter = 'open' | 'homework' | 'done';
const filter = signal<Filter>('open');
const subjectFilter = signal<string | null>(null);

/** All tasks: overdue / today / upcoming / no date; filter by homework & subject. */
export function TasksView() {
  const now = today();
  const f = filter.value;
  const subj = subjectFilter.value;
  const match = (t: { subjectId: string | null }): boolean => (f !== 'homework' || t.subjectId !== null) && (!subj || t.subjectId === subj);

  const open = openTasks.value.filter(match);
  const groups =
    f === 'done'
      ? [{ title: 'Выполнено', items: tasks.all.value.filter((t) => t.done && match(t)).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).slice(0, 50) }]
      : [
          { title: 'Просрочено', items: overdueTasks(now).filter(match) },
          { title: 'Сегодня', items: open.filter((t) => t.date === now) },
          { title: 'Дальше', items: open.filter((t) => t.date !== null && compareDates(t.date, now) > 0).sort(byDue) },
          { title: 'Без даты', items: open.filter((t) => t.date === null) },
        ];
  const empty = groups.every((g) => g.items.length === 0);

  return (
    <>
      <div class="tasks__filters">
        <ChoiceChips
          options={[
            { value: 'open', label: 'Активные' },
            { value: 'homework', label: 'ДЗ' },
            { value: 'done', label: 'Выполненные' },
          ]}
          value={f}
          onChange={(v) => v && (filter.value = v)}
        />
        {f === 'homework' && activeSubjects.value.length > 0 && (
          <ChoiceChips
            allowNone
            options={activeSubjects.value.map((s) => ({ value: s.id, label: s.name, color: colorVar(s.color) }))}
            value={subj}
            onChange={(v) => (subjectFilter.value = v)}
          />
        )}
      </div>
      {empty ? (
        <EmptyState
          icon="tasks"
          title={f === 'done' ? 'Пока ничего не выполнено' : 'Задач нет'}
          action={f !== 'done' ? <Button variant="primary" icon="plus" onClick={() => openTaskForm()}>Новая задача</Button> : undefined}
        />
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <Section key={g.title} title={`${g.title} · ${g.items.length}`}>
              <List>
                {g.items.map((t) => (
                  <TaskRow key={t.id} task={t} showDate={g.title !== 'Сегодня'} />
                ))}
              </List>
            </Section>
          ))
      )}
    </>
  );
}
