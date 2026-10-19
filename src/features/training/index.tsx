import { nowMinutes, today, type ISODate } from '@/core/date';
import type { FeatureDef } from '@/core/registry';
import { navigate } from '@/core/router';
import type { BusyBlock } from '@/core/timeline';
import { Button } from '@/ui';
import { colorVar } from '@/ui/forms';
import { ExerciseScreen, ExercisesScreen } from './LibraryScreens';
import { activeSession, cancelledWorkouts, plannedWorkouts, sessionForSlot, sessionsOn, templates, type PlannedWorkout } from './model';
import { openAddWorkout, openWorkoutSlot, ProgramDayScreen, ProgramScreen } from './ProgramScreens';
import { ProgressScreen } from './ProgressScreen';
import { SessionScreen } from './SessionScreen';
import { TemplateEditor, TemplatesScreen } from './TemplateScreens';
import { HistoryScreen, StartNowList, TodayWorkouts } from './TrainingView';
import { t } from '@/core/i18n';

function plannedBlock(date: ISODate, p: PlannedWorkout): BusyBlock {
  const s = sessionForSlot(date, p.key);
  return {
    id: p.key,
    source: 'training',
    title: p.template?.name ?? t('training.workout'),
    subtitle: s ? (s.finished ? t('training.doneMark') : t('training.inProgressLower')) : t('training.blockSub', { n: p.template?.exercises.length ?? 0 }),
    start: p.data.start,
    end: p.data.end,
    placeId: p.data.placeId,
    color: colorVar(p.template?.color ?? 'c8'),
  };
}

function blocksFor(date: ISODate): BusyBlock[] {
  const adHoc = sessionsOn(date)
    .filter((s) => s.slotKey === null)
    .map((s): BusyBlock => {
      const tpl = s.templateId ? templates.get(s.templateId) : undefined;
      return {
        id: `session:${s.id}`,
        source: 'training',
        title: s.title,
        subtitle: s.finished ? t('training.doneMark') : t('training.inProgressLower'),
        start: s.start,
        end: s.end ?? Math.min(1440, s.start + (tpl?.duration ?? 60)),
        placeId: null,
        color: colorVar(tpl?.color ?? 'c2'),
      };
    });
  return [...plannedWorkouts(date).map((p) => plannedBlock(date, p)), ...adHoc];
}

function QuickWorkout({ close }: { close: () => void }) {
  const active = activeSession.value;
  return (
    <>
      {active && (
        <Button
          variant="primary"
          size="lg"
          block
          icon="dumbbell"
          onClick={() => {
            close();
            navigate(`health/session/${active.id}`);
          }}
        >
          {t('training.continueNamed', { name: active.title })}
        </Button>
      )}
      <p class="brief__group">{t('training.plannedToday')}</p>
      <TodayWorkouts />
      <p class="brief__group">{t('training.startNow')}</p>
      <StartNowList close={close} />
    </>
  );
}

/** Relevance: an active session, or a planned workout starting within ±90 minutes. */
function relevance(): number {
  if (activeSession.value) return 1;
  const now = nowMinutes();
  const soon = plannedWorkouts(today()).some((p) => !sessionForSlot(today(), p.key) && now >= p.data.start - 90 && now <= p.data.end);
  return soon ? 0.9 : 0;
}

export const trainingFeature: FeatureDef = {
  id: 'training',
  module: 'training',
  routes: [
    { pattern: 'health/program', component: ProgramScreen },
    { pattern: 'health/program/day/:index', component: ProgramDayScreen },
    { pattern: 'health/templates', component: TemplatesScreen },
    { pattern: 'health/template/:id', component: TemplateEditor },
    { pattern: 'health/exercises', component: ExercisesScreen },
    { pattern: 'health/exercise/:id', component: ExerciseScreen },
    { pattern: 'health/progress', component: ProgressScreen },
    { pattern: 'health/history', component: HistoryScreen },
    { pattern: 'health/session/:id', component: SessionScreen },
  ],
  busySources: [
    {
      id: 'training',
      blocksFor,
      cancelledFor: (date) => cancelledWorkouts(date).map((p) => plannedBlock(date, p)),
      open: openWorkoutSlot,
    },
  ],
  dayActions: [{ id: 'workout', label: 'training.oneOffWorkout', icon: 'dumbbell', order: 15, run: openAddWorkout }],
  quickActions: [
    {
      id: 'workout',
      label: 'training.workout',
      icon: 'dumbbell',
      order: 12,
      relevance,
      hint: () => {
        const a = activeSession.value;
        if (a) return t('training.inProgressLower');
        const next = plannedWorkouts(today()).find((p) => !sessionForSlot(today(), p.key));
        return next ? `${next.template?.name ?? ''}`.trim() || null : null;
      },
      screen: QuickWorkout,
    },
  ],
};
