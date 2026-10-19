import type { ISODate } from '@/core/date';
import type { BusyBlock } from '@/core/timeline';
import { homeworkFor } from '@/features/tasks/model';
import { colorVar } from '@/ui/forms';
import { cancelledLessonsFor, lessonsFor, type Lesson } from './model';
import { t } from '@/core/i18n';

function toBlock(date: ISODate, l: Lesson): BusyBlock {
  const open = homeworkFor(date, l.key).filter((t) => !t.done).length;
  return {
    id: l.key,
    source: 'schedule',
    title: l.subject?.name ?? t('schedule.lesson'),
    subtitle: [l.type?.short, l.room, l.data.online ? t('schedule.onlineLower') : null].filter(Boolean).join(' · '),
    start: l.data.start,
    end: l.data.end,
    placeId: l.placeId,
    color: colorVar(l.subject?.color ?? 'c8'),
    ...(open > 0 ? { badge: t('schedule.homeworkBadge', { n: open }) } : {}),
  };
}

export const lessonBlocks = (date: ISODate): BusyBlock[] => lessonsFor(date).map((l) => toBlock(date, l));
export const cancelledLessonBlocks = (date: ISODate): BusyBlock[] => cancelledLessonsFor(date).map((l) => toBlock(date, l));
