import type { FeatureDef } from '@/core/registry';
import { colorVar } from '@/ui';
import { addDays, formatTime } from '@/core/date';
import type { BusyBlock } from '@/core/timeline';
import { shiftsFor, type Shift } from './model';
import { JobDayEditor, JobEditor, JobsScreen, openAddShift, openShiftSheet } from './screens';
import { t } from '@/core/i18n';

const PREV = '~prev';

function shiftBlock(s: Shift): BusyBlock {
  return {
    id: s.key,
    source: 'work',
    title: s.job?.name ?? t('work.shift'),
    subtitle: s.origin === 'added' ? t('work.oneOffShiftLower') : t('work.shiftLower'),
    start: s.data.start,
    end: s.data.end,
    placeId: s.job?.placeId ?? null,
    color: colorVar(s.job?.color ?? 'c7'),
  };
}

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
      // A night shift shows on both days: until midnight, then from 00:00 the next morning.
      blocksFor: (date): BusyBlock[] => [
        ...shiftsFor(addDays(date, -1))
          .filter((s) => s.data.end > 1440)
          .map((s) => ({ ...shiftBlock(s), id: `${s.key}${PREV}`, start: 0, end: s.data.end - 1440, continued: true, subtitle: t('work.sinceYesterday', { time: formatTime(s.data.start) }) })),
        ...shiftsFor(date).map((s) => ({
          ...shiftBlock(s),
          end: Math.min(s.data.end, 1440),
          ...(s.data.end > 1440 ? { continues: true, subtitle: t('work.untilTomorrow', { time: formatTime(s.data.end - 1440) }) } : {}),
        })),
      ],
      open: (date, id) => (id.endsWith(PREV) ? openShiftSheet(addDays(date, -1), id.slice(0, -PREV.length)) : openShiftSheet(date, id)),
    },
  ],
  dayActions: [{ id: 'shift', label: 'work.oneOffShift', icon: 'briefcase', order: 20, run: openAddShift }],
};
