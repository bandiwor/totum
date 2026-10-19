import type { FeatureDef } from '@/core/registry';
import { colorVar } from '@/ui';
import { shiftsFor } from './model';
import { JobDayEditor, JobEditor, JobsScreen, openAddShift, openShiftSheet } from './screens';

export const workFeature: FeatureDef = {
  id: 'work',
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
          title: s.job?.name ?? 'Смена',
          subtitle: s.origin === 'added' ? 'разовая смена' : 'смена',
          start: s.data.start,
          end: s.data.end,
          placeId: s.job?.placeId ?? null,
          color: colorVar(s.job?.color ?? 'c7'),
        })),
      open: openShiftSheet,
    },
  ],
  dayActions: [{ id: 'shift', label: 'Разовая смена', icon: 'briefcase', order: 20, run: openAddShift }],
};
