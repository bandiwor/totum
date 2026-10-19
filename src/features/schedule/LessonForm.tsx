import { useState } from 'preact/hooks';
import { formatTime } from '@/core/date';
import { haptic } from '@/core/haptics';
import { navigate } from '@/core/router';
import { Button, ChoiceChips, colorVar, EmptyState, Field, Form, List, ListRow, SheetActions, Switch, TextField, TimeRange } from '@/ui';
import { activeSubjects, bells, sortedLessonTypes, subjects, type LessonData } from './model';
import { t } from '@/core/i18n';

export function defaultLesson(): LessonData {
  const first = bells.value.value.slots[0];
  return {
    subjectId: activeSubjects.value[0]?.id ?? '',
    typeId: sortedLessonTypes.value[0]?.id ?? null,
    start: first?.start ?? 9 * 60,
    end: first?.end ?? 10 * 60 + 30,
    bell: first?.n ?? null,
    room: null,
    placeId: null,
    online: false,
  };
}

/** Edits a lesson: used for the timetable template and for one-date changes. */
export function LessonForm({
  initial,
  onSave,
  onDelete,
  saveLabel = t('common.save'),
  close,
}: {
  initial: LessonData;
  onSave: (data: LessonData) => void;
  onDelete?: () => void;
  saveLabel?: string;
  close: () => void;
}) {
  const [d, setD] = useState<LessonData>(initial);
  const patch = (p: Partial<LessonData>): void => setD((cur) => ({ ...cur, ...p }));
  const slots = bells.value.value.slots;
  const subject = subjects.get(d.subjectId);
  const subjectOptions = activeSubjects.value.map((s) => ({ value: s.id, label: s.name, color: colorVar(s.color) }));

  if (subjectOptions.length === 0) {
    return (
      <EmptyState
        icon="notes"
        title={t('schedule.addSubjectsFirst')}
        action={
          <Button
            variant="primary"
            onClick={() => {
              close();
              navigate('plan/subjects');
            }}
          >
            {t('schedule.toSubjects')}
          </Button>
        }
      />
    );
  }

  return (
    <Form>
      <Field label={t('schedule.subject')}>
        <ChoiceChips options={subjectOptions} value={d.subjectId} onChange={(id) => id && patch({ subjectId: id })} />
      </Field>
      <Field label={t('schedule.type')}>
        <ChoiceChips
          options={sortedLessonTypes.value.map((t) => ({ value: t.id, label: t.name, color: colorVar(t.color) }))}
          value={d.typeId}
          allowNone
          onChange={(typeId) => patch({ typeId })}
        />
      </Field>
      {slots.length > 0 && (
        <Field label={t('schedule.pairNumber')}>
          <ChoiceChips
            options={[...slots.map((s) => ({ value: s.n, label: t('schedule.bellOption', { n: s.n, time: formatTime(s.start) }) })), { value: 0, label: t('schedule.customTime') }]}
            value={d.bell ?? 0}
            onChange={(n) => {
              const slot = slots.find((s) => s.n === n);
              patch(slot ? { bell: slot.n, start: slot.start, end: slot.end } : { bell: null });
            }}
          />
        </Field>
      )}
      {(slots.length === 0 || d.bell === null) && <TimeRange start={d.start} end={d.end} onChange={(start, end) => patch({ start, end })} />}
      <TextField
        label={t('schedule.room')}
        value={d.room ?? ''}
        placeholder={subject?.room ? t('schedule.roomInherited', { room: subject.room }) : t('schedule.roomNone')}
        onValue={(room) => patch({ room: room.trim() ? room : null })}
      />
      <List>
        <ListRow title={t('schedule.online')} subtitle={t('schedule.noTravel')} trailing={<Switch label={t('schedule.online')} checked={d.online} onChange={(online) => patch({ online })} />} />
      </List>
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          feedback={false}
          disabled={!d.subjectId || d.end <= d.start}
          onClick={() => {
            haptic('success');
            onSave(d);
            close();
          }}
        >
          {saveLabel}
        </Button>
        {onDelete && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={() => {
              onDelete();
              close();
            }}
          >
            {t('common.delete')}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}
