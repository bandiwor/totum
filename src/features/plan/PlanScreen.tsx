import { signal } from '@preact/signals';
import { openTaskForm } from '@/features/tasks/TaskForm';
import { TasksView } from '@/features/tasks/TasksView';
import { IconButton, Page, SegmentedControl } from '@/ui';
import { SetupList } from './SetupList';
import { WeekView } from './WeekView';

type Tab = 'week' | 'tasks' | 'setup';
const tab = signal<Tab>('week');

const TABS = [
  { value: 'week', label: 'Неделя' },
  { value: 'tasks', label: 'Задачи' },
  { value: 'setup', label: 'Настройка' },
] as const;

export function PlanScreen() {
  return (
    <Page
      title="План"
      large
      actions={tab.value === 'tasks' ? <IconButton icon="plus" label="Новая задача" variant="accent" onClick={() => openTaskForm()} /> : undefined}
      toolbar={<SegmentedControl options={TABS} value={tab.value} onChange={(v) => (tab.value = v)} />}
    >
      {tab.value === 'week' && <WeekView />}
      {tab.value === 'tasks' && <TasksView />}
      {tab.value === 'setup' && <SetupList />}
    </Page>
  );
}

export function SetupScreen() {
  return (
    <Page title="Настройка плана" back>
      <SetupList />
    </Page>
  );
}
