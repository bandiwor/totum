import { signal } from '@preact/signals';
import { compareDates, today } from '@/core/date';
import { activeSubjects } from '@/features/schedule/model';
import { Button, ChoiceChips, colorVar, EmptyState, List, Section } from '@/ui';
import { byDue, openTasks, overdueTasks, tasks } from './model';
import { openTaskForm } from './TaskForm';
import { TaskRow } from './TaskRow';
import { t } from '@/core/i18n';

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
      ? [{ title: t('tasks.done'), today: false, items: tasks.all.value.filter((x) => x.done && match(x)).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)).slice(0, 50) }]
      : [
          { title: t('tasks.overdue'), today: false, items: overdueTasks(now).filter(match) },
          { title: t('tasks.today'), today: true, items: open.filter((x) => x.date === now) },
          { title: t('tasks.later'), today: false, items: open.filter((x) => x.date !== null && compareDates(x.date, now) > 0).sort(byDue) },
          { title: t('tasks.noDate'), today: false, items: open.filter((x) => x.date === null) },
        ];
  const empty = groups.every((g) => g.items.length === 0);

  return (
    <>
      <div class="tasks__filters">
        <ChoiceChips
          options={(['open', 'homework', 'done'] as const).map((value) => ({ value, label: t(`tasks.filters.${value}`) }))}
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
          title={f === 'done' ? t('tasks.nothingDone') : t('tasks.noTasks')}
          action={f !== 'done' ? <Button variant="primary" icon="plus" onClick={() => openTaskForm()}>{t('tasks.newTask')}</Button> : undefined}
        />
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <Section key={g.title} title={t('tasks.groupTitle', { title: g.title, count: g.items.length })}>
              <List>
                {g.items.map((x) => (
                  <TaskRow key={x.id} task={x} showDate={!g.today} />
                ))}
              </List>
            </Section>
          ))
      )}
    </>
  );
}
