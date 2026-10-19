import { useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { t, type PlainKey } from '@/core/i18n';
import { navigate } from '@/core/router';
import { createAutoBackup } from '@/core/store/backup';
import { resetData } from '@/core/store/store';
import { Button, confirm, List, ListRow, SheetActions, Switch, toast, type IconName } from '@/ui';

/** What "reset" can clear, by area. Collections not listed here go only with a full reset. */
const AREAS: readonly { id: string; label: PlainKey; icon: IconName; collections: string[]; docs: string[] }[] = [
  {
    id: 'plan',
    label: 'reset.areas.plan',
    icon: 'calendar',
    collections: ['places', 'routes', 'subjects', 'lessonTypes', 'timetables', 'lessonOverrides', 'tasks', 'jobs', 'shiftOverrides'],
    docs: ['bells'],
  },
  {
    id: 'training',
    label: 'reset.areas.training',
    icon: 'dumbbell',
    collections: ['exerciseCategories', 'exercises', 'workoutTemplates', 'workoutOverrides', 'workoutSessions'],
    docs: ['trainingProgram'],
  },
  {
    id: 'nutrition',
    label: 'reset.areas.nutrition',
    icon: 'apple',
    collections: ['foods', 'foodLog', 'intakeItems', 'intakeLog', 'waterLog', 'weightLog'],
    docs: ['mealPlan', 'bodyProfile'],
  },
  { id: 'sleep', label: 'reset.areas.sleep', icon: 'moon', collections: ['sleepLog'], docs: [] },
  { id: 'money', label: 'reset.areas.money', icon: 'wallet', collections: ['moneyCategories', 'transactions', 'recurring', 'goals'], docs: ['money'] },
  { id: 'notes', label: 'reset.areas.notes', icon: 'notes', collections: ['noteCollections', 'notes'], docs: [] },
  { id: 'settings', label: 'reset.areas.settings', icon: 'settings', collections: ['languages'], docs: ['settings'] },
];

export function ResetSheet({ close }: { close: () => void }) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());

  const toggle = (id: string, on: boolean): void => {
    const next = new Set(picked);
    if (on) next.add(id);
    else next.delete(id);
    setPicked(next);
  };

  const run = async (all: boolean): Promise<void> => {
    const ok = await confirm({
      title: all ? t('reset.allTitle') : t('reset.someTitle'),
      message: t('reset.message'),
      confirmLabel: t('reset.confirm'),
      danger: true,
    });
    if (!ok) return;
    await createAutoBackup(t('reset.backupReason'));
    const chosen = AREAS.filter((a) => picked.has(a.id));
    await resetData(all ? null : { collections: chosen.flatMap((a) => a.collections), docs: chosen.flatMap((a) => a.docs) });
    haptic('success');
    toast(t('reset.done'), { tone: 'success' });
    close();
    // A full reset (or a settings reset) brings back the welcome screen.
    navigate('today', { replace: true });
  };

  return (
    <>
      <p class="sheet-note">{t('reset.text')}</p>
      <List>
        {AREAS.map((a) => (
          <ListRow key={a.id} icon={a.icon} title={t(a.label)} trailing={<Switch label={t(a.label)} checked={picked.has(a.id)} onChange={(on) => toggle(a.id, on)} />} />
        ))}
      </List>
      <SheetActions>
        <Button variant="danger" size="lg" block disabled={picked.size === 0} feedback={false} onClick={() => void run(false)}>
          {t('reset.selected')}
        </Button>
        <Button variant="ghost" block icon="trash" feedback={false} onClick={() => void run(true)}>
          {t('reset.all')}
        </Button>
      </SheetActions>
    </>
  );
}
