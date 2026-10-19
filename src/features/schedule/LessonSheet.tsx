import { cycleDayIndex } from '@/core/cycle';
import { formatRelativeDay, formatTime, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { navigate } from '@/core/router';
import { places } from '@/features/places/model';
import { homeworkFor, tasks } from '@/features/tasks/model';
import { openTaskForm, toggleTask } from '@/features/tasks/TaskForm';
import { Badge, Button, Checkbox, colorVar, List, ListRow, openSheet, Section, SheetActions } from '@/ui';
import { LessonForm, defaultLesson } from './LessonForm';
import { findLesson, lessonOverrides, timetableFor } from './model';
import { t } from '@/core/i18n';

/** Details of one dated lesson: homework, one-off changes, jump to the template. */
function LessonDetails({ date, lessonKey, close }: { date: ISODate; lessonKey: string; close: () => void }) {
  const lesson = findLesson(date, lessonKey);
  if (!lesson) return null;
  const cancelled = lessonOverrides.isCancelled(date, lessonKey);
  const hw = homeworkFor(date, lessonKey);
  // Read tasks so the sheet re-renders when homework changes.
  void tasks.all.value;
  const place = lesson.placeId ? places.get(lesson.placeId)?.name : lesson.data.online ? t('schedule.online') : null;
  const tt = timetableFor(date);

  const editOnce = () =>
    void openSheet(
      (c) => (
        <LessonForm
          initial={lesson.data}
          saveLabel={t('schedule.saveForDay')}
          onSave={(data) => lessonOverrides.modify(date, lessonKey, data)}
          close={c}
        />
      ),
      { title: t('schedule.onlyThisDay') },
    );

  return (
    <>
      <div class="lesson-head" style={{ '--lesson-color': colorVar(lesson.subject?.color ?? 'c8') }}>
        <span class="lesson-head__bar" />
        <div>
          <p class="lesson-head__time num">
            {t('schedule.dayHeader', { day: formatRelativeDay(date), from: formatTime(lesson.data.start), to: formatTime(lesson.data.end) })}
          </p>
          <div class="lesson-head__badges">
            {lesson.type && <Badge>{lesson.type.name}</Badge>}
            {cancelled && <Badge tone="danger">{t('schedule.cancelled')}</Badge>}
            {lesson.modified && <Badge tone="warning">{t('schedule.modified')}</Badge>}
            {lesson.origin === 'added' && <Badge tone="accent">{t('schedule.oneOff')}</Badge>}
          </div>
        </div>
      </div>

      <List>
        {lesson.teacher && <ListRow icon="notes" title={lesson.teacher.name} subtitle={lesson.teacher.position || t('schedule.teacher')} />}
        {(lesson.room || place) && <ListRow icon="pin" title={[lesson.room, place].filter(Boolean).join(' · ')} subtitle={t('common.where')} />}
      </List>

      <Section
        title={t('schedule.homework')}
        action={
          <Button
            size="sm"
            variant="ghost"
            icon="plus"
            onClick={() =>
              openTaskForm({ preset: { subjectId: lesson.data.subjectId, date, lesson: { date, key: lessonKey } } })
            }
          >
            {t('schedule.homeworkShort')}
          </Button>
        }
      >
        {hw.length > 0 ? (
          <List>
            {hw.map((t) => (
              <ListRow
                key={t.id}
                leading={<Checkbox checked={t.done} label={t.title} celebrate="task-done" onChange={(v) => toggleTask(t, v)} />}
                title={t.title}
                {...(t.note ? { subtitle: t.note } : {})}
                onClick={() => openTaskForm({ task: t })}
              />
            ))}
          </List>
        ) : (
          <p class="sheet-note">{t('schedule.noHomework')}</p>
        )}
      </Section>

      <SheetActions>
        {cancelled || lesson.modified ? (
          <Button
            block
            icon="history"
            onClick={() => {
              lessonOverrides.reset(date, lessonKey);
              haptic('success');
            }}
          >
            {t('schedule.restore')}
          </Button>
        ) : null}
        {!cancelled && (
          <Button block icon="pencil" onClick={editOnce}>
            {t('schedule.editThisDay')}
          </Button>
        )}
        {!cancelled && (
          <Button
            block
            variant="danger"
            icon="x"
            onClick={() => {
              lessonOverrides.cancel(date, lessonKey);
              haptic('warning');
              if (lesson.origin === 'added') close();
            }}
          >
            {lesson.origin === 'added' ? t('schedule.deleteOneOff') : t('schedule.cancelLesson')}
          </Button>
        )}
        {tt && lesson.origin === 'template' && (
          <Button
            block
            variant="ghost"
            onClick={() => {
              close();
              navigate(`plan/timetable/${tt.id}/day/${cycleDayIndex(tt.cycle, date)}`);
            }}
          >
            {t('schedule.editInTimetable')}
          </Button>
        )}
      </SheetActions>
    </>
  );
}

export function openLessonSheet(date: ISODate, lessonKey: string): void {
  const lesson = findLesson(date, lessonKey);
  openSheet((close) => <LessonDetails date={date} lessonKey={lessonKey} close={close} />, {
    title: lesson?.subject?.name ?? t('schedule.lesson'),
  });
}

export function openAddLesson(date: ISODate): void {
  openSheet(
    (close) => (
      <LessonForm initial={defaultLesson()} saveLabel={t('schedule.addForDay')} onSave={(data) => lessonOverrides.add(date, data)} close={close} />
    ),
    { title: t('schedule.oneOffLesson') },
  );
}
