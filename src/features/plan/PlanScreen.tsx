import { signal } from '@preact/signals';
import { openTaskForm } from '@/features/tasks/TaskForm';
import { TasksView } from '@/features/tasks/TasksView';
import { IconButton, Page, SegmentedControl } from '@/ui';
import { SetupList } from './SetupList';
import { WeekView } from './WeekView';
import { t } from '@/core/i18n';

type Tab = 'week' | 'tasks' | 'setup';
const tab = signal<Tab>('week');

const TABS: readonly Tab[] = ['week', 'tasks', 'setup'];

export function PlanScreen() {
  return (
    <Page
      title={t('plan.title')}
      large
      scrollKey={tab.value}
      actions={tab.value === 'tasks' ? <IconButton icon="plus" label={t('plan.newTask')} variant="accent" onClick={() => openTaskForm()} /> : undefined}
      toolbar={<SegmentedControl options={TABS.map((value) => ({ value, label: t(`plan.tabs.${value}`) }))} value={tab.value} onChange={(v) => (tab.value = v)} />}
    >
      {tab.value === 'week' && <WeekView />}
      {tab.value === 'tasks' && <TasksView />}
      {tab.value === 'setup' && <SetupList />}
    </Page>
  );
}

export function SetupScreen() {
  return (
    <Page title={t('plan.setupTitle')} back>
      <SetupList />
    </Page>
  );
}
