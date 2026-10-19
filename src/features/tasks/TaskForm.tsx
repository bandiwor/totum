import { useState } from 'preact/hooks';
import { addDays, formatRelativeDay, formatTime, today, type ISODate, type Minutes } from '@/core/date';
import { haptic } from '@/core/haptics';
import { fx } from '@/core/fx';
import { activeSubjects, nextLessonOf } from '@/features/schedule/model';
import {
  Button,
  ChoiceChips,
  colorVar,
  confirm,
  DateField,
  Field,
  Form,
  List,
  ListRow,
  openSheet,
  SheetActions,
  Switch,
  TextArea,
  TextField,
  TimeField,
} from '@/ui';
import { tasks, type Task } from './model';
import { t } from '@/core/i18n';

type Draft = Pick<Task, 'title' | 'note' | 'date' | 'time' | 'subjectId' | 'lesson'>;

export interface TaskFormProps {
  task?: Task;
  preset?: Partial<Draft>;
  close: () => void;
}

export function TaskForm({ task, preset, close }: TaskFormProps) {
  const now = today();
  const [d, setD] = useState<Draft>({
    title: task?.title ?? preset?.title ?? '',
    note: task?.note ?? preset?.note ?? '',
    date: task ? task.date : (preset?.date ?? now),
    time: task?.time ?? preset?.time ?? null,
    subjectId: task?.subjectId ?? preset?.subjectId ?? null,
    lesson: task?.lesson ?? preset?.lesson ?? null,
  });
  const patch = (p: Partial<Draft>): void => setD((cur) => ({ ...cur, ...p }));

  const tomorrow = addDays(now, 1);
  const dateMode = d.lesson ? 'lesson' : d.date === now ? 'today' : d.date === tomorrow ? 'tomorrow' : d.date === null ? 'none' : 'pick';
  const nextLesson = d.subjectId ? nextLessonOf(d.subjectId, now) : undefined;

  const save = (): void => {
    const title = d.title.trim();
    if (!title) return;
    if (task) tasks.update(task.id, { ...d, title });
    else tasks.add({ ...d, title, done: false, doneAt: null });
    haptic('success');
    close();
  };

  const remove = async (): Promise<void> => {
    if (!task) return;
    if (await confirm({ title: t('tasks.deleteTask'), confirmLabel: t('common.delete'), danger: true })) {
      tasks.remove(task.id);
      close();
    }
  };

  const dateOptions = [
    { value: 'today', label: t('tasks.today') },
    { value: 'tomorrow', label: t('tasks.tomorrow') },
    ...(nextLesson ? [{ value: 'lesson', label: t('tasks.toLesson', { day: formatRelativeDay(nextLesson.date).toLowerCase() }) }] : []),
    { value: 'pick', label: t('tasks.pickDate') },
    { value: 'none', label: t('tasks.noDate') },
  ];

  const setDateMode = (mode: string | null): void => {
    switch (mode) {
      case 'today':
        return patch({ date: now, lesson: null });
      case 'tomorrow':
        return patch({ date: tomorrow, lesson: null });
      case 'lesson':
        return nextLesson ? patch({ date: nextLesson.date, lesson: { date: nextLesson.date, key: nextLesson.key } }) : undefined;
      case 'none':
        return patch({ date: null, time: null, lesson: null });
      case 'pick':
        return patch({ date: d.date ?? addDays(now, 2), lesson: null });
    }
  };

  return (
    <Form>
      <TextField
        value={d.title}
        onValue={(title) => patch({ title })}
        placeholder={t('tasks.placeholder')}
        autoFocus={!task}
        enterKeyHint="done"
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      {activeSubjects.value.length > 0 && (
        <Field label={t('tasks.subjectForHw')}>
          <ChoiceChips
            allowNone
            options={activeSubjects.value.map((s) => ({ value: s.id, label: s.name, color: colorVar(s.color) }))}
            value={d.subjectId}
            onChange={(subjectId) => patch({ subjectId, lesson: subjectId === d.subjectId ? d.lesson : null })}
          />
        </Field>
      )}
      <Field label={t('tasks.when')}>
        <ChoiceChips options={dateOptions} value={dateMode} onChange={setDateMode} />
      </Field>
      {dateMode === 'pick' && <DateField clearable value={d.date} onChange={(date: ISODate | null) => patch({ date })} />}
      {d.date !== null && !d.lesson && (
        <List>
          <ListRow
            title={t('tasks.atTime')}
            {...(d.time !== null ? { subtitle: formatTime(d.time) } : {})}
            trailing={<Switch label={t('tasks.atTime')} checked={d.time !== null} onChange={(on) => patch({ time: on ? 18 * 60 : null })} />}
          />
        </List>
      )}
      {d.time !== null && !d.lesson && <TimeField value={d.time} onChange={(time: Minutes) => patch({ time })} />}
      <TextArea value={d.note} onValue={(note) => patch({ note })} placeholder={t('common.note')} rows={3} />
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!d.title.trim()} feedback={false} onClick={save}>
          {task ? t('common.save') : t('common.add')}
        </Button>
        {task && (
          <Button variant="danger" block icon="trash" onClick={() => void remove()}>
            {t('common.delete')}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

export function openTaskForm(props: Omit<TaskFormProps, 'close'> = {}): void {
  openSheet((close) => <TaskForm {...props} close={close} />, { title: props.task ? t('tasks.task') : t('tasks.newTask') });
}

/** Toggle with celebration when the day's list is finished. */
export function toggleTask(task: Task, done: boolean, origin?: Element): void {
  tasks.update(task.id, { done, doneAt: done ? Date.now() : null });
  if (done && task.date) {
    const left = tasks.all.value.filter((t) => t.date === task.date && !t.done);
    if (left.length === 0) fx('all-tasks-done', origin ?? null);
  }
}
