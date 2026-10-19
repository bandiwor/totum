import type { FeatureDef } from '@/core/registry';
import { colorVar } from '@/ui';
import { shiftsFor } from './model';
import { JobDayEditor, JobEditor, JobsScreen, openAddShift, openShiftSheet } from './screens';
import { t } from '@/core/i18n';

export const workFeature: FeatureDef = {
  id: 'work',
  module: 'work',
  routes: [
    { pattern: 'plan/work', component: JobsScreen },
    { pattern: 'plan/work/:id', component: JobEditor },
    { pattern: 'plan/work/:id/day/:index', component: JobDayEditor },
  ],
  busySources: [
    {
      id: 'work',
      blocksFor: (date) =>
        shiftsFor(date).map((s) => ({
          id: s.key,
          source: 'work',
          title: s.job?.name ?? t('work.shift'),
          subtitle: s.origin === 'added' ? t('work.oneOffShiftLower') : t('work.shiftLower'),
          start: s.data.start,
          end: s.data.end,
          placeId: s.job?.placeId ?? null,
          color: colorVar(s.job?.color ?? 'c7'),
        })),
      open: openShiftSheet,
    },
  ],
  dayActions: [{ id: 'shift', label: 'work.oneOffShift', icon: 'briefcase', order: 20, run: openAddShift }],
};
