import type { FeatureDef } from '@/core/registry';
import { BellsScreen } from './BellsScreen';
import { cancelledLessonBlocks, lessonBlocks } from './busy';
import { openAddLesson, openLessonSheet } from './LessonSheet';
import { SubjectsScreen } from './SubjectsScreen';
import { TimetableDayEditor, TimetableEditor, TimetablesScreen } from './TimetablesScreen';
import { TypesScreen } from './TypesScreen';

export const scheduleFeature: FeatureDef = {
  id: 'schedule',
  module: 'schedule',
  routes: [
    { pattern: 'plan/subjects', component: SubjectsScreen },
    { pattern: 'plan/types', component: TypesScreen },
    { pattern: 'plan/bells', component: BellsScreen },
    { pattern: 'plan/timetables', component: TimetablesScreen },
    { pattern: 'plan/timetable/:id', component: TimetableEditor },
    { pattern: 'plan/timetable/:id/day/:index', component: TimetableDayEditor },
  ],
  busySources: [{ id: 'schedule', blocksFor: lessonBlocks, cancelledFor: cancelledLessonBlocks, open: openLessonSheet }],
  dayActions: [{ id: 'lesson', label: 'schedule.oneOffLesson', icon: 'calendar', order: 10, run: openAddLesson }],
};
