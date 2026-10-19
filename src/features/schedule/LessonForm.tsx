import { useState } from 'preact/hooks';
import { formatTime } from '@/core/date';
import { haptic } from '@/core/haptics';
import { navigate } from '@/core/router';
import { Button, ChoiceChips, colorVar, EmptyState, Field, Form, List, ListRow, SheetActions, Switch, TextField, TimeRange } from '@/ui';
import { activeSubjects, bells, sortedLessonTypes, subjects, type LessonData } from './model';

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
  saveLabel = 'Сохранить',
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
        title="Сначала добавь предметы"
        action={
          <Button
            variant="primary"
            onClick={() => {
              close();
              navigate('plan/subjects');
            }}
          >
            К предметам
          </Button>
        }
      />
    );
  }

  return (
    <Form>
      <Field label="Предмет">
        <ChoiceChips options={subjectOptions} value={d.subjectId} onChange={(id) => id && patch({ subjectId: id })} />
      </Field>
      <Field label="Тип">
        <ChoiceChips
          options={sortedLessonTypes.value.map((t) => ({ value: t.id, label: t.name, color: colorVar(t.color) }))}
          value={d.typeId}
          allowNone
          onChange={(typeId) => patch({ typeId })}
        />
      </Field>
      {slots.length > 0 && (
        <Field label="Пара">
          <ChoiceChips
            options={[...slots.map((s) => ({ value: s.n, label: `${s.n} · ${formatTime(s.start)}` })), { value: 0, label: 'Своё время' }]}
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
        label="Аудитория"
        value={d.room ?? ''}
        placeholder={subject?.room ? `${subject.room} (как у предмета)` : 'Не указана'}
        onValue={(room) => patch({ room: room.trim() ? room : null })}
      />
      <List>
        <ListRow title="Онлайн" subtitle="Без дороги" trailing={<Switch label="Онлайн" checked={d.online} onChange={(online) => patch({ online })} />} />
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
            Удалить
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}
