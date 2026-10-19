import { useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { PlacePicker } from '@/features/places/PlacePicker';
import {
  Button,
  ColorPicker,
  colorVar,
  confirm,
  EmptyState,
  Field,
  Form,
  List,
  ListRow,
  openSheet,
  Page,
  Section,
  SheetActions,
  Switch,
  TextField,
  type ColorKey,
} from '@/ui';
import { subjects, timetables, type Subject } from './model';

function isUsed(id: string): boolean {
  return timetables.all.value.some((t) => t.cycle.days.some((day) => day.some((l) => l.subjectId === id)));
}

function SubjectForm({ subject, close }: { subject: Subject | null; close: () => void }) {
  const [name, setName] = useState(subject?.name ?? '');
  const [color, setColor] = useState(subject?.color ?? (`c${(subjects.all.value.length % 8) + 1}` as ColorKey));
  const [teacher, setTeacher] = useState(subject?.teacher ?? '');
  const [room, setRoom] = useState(subject?.room ?? '');
  const [placeId, setPlaceId] = useState(subject?.placeId ?? null);
  const [archived, setArchived] = useState(subject?.archived ?? false);

  const save = (): void => {
    const data = { name: name.trim(), color, teacher: teacher.trim(), room: room.trim(), placeId, archived };
    if (!data.name) return;
    if (subject) subjects.update(subject.id, data);
    else subjects.add(data);
    haptic('success');
    close();
  };

  const remove = async (): Promise<void> => {
    if (!subject) return;
    if (isUsed(subject.id)) {
      await confirm({ title: 'Предмет есть в расписании', message: 'Убери его из расписания или отправь в архив.', confirmLabel: 'Понятно' });
      return;
    }
    if (await confirm({ title: `Удалить «${subject.name}»?`, confirmLabel: 'Удалить', danger: true })) {
      subjects.remove(subject.id);
      close();
    }
  };

  return (
    <Form>
      <TextField label="Название" value={name} onValue={setName} placeholder="Матанализ" autoFocus={!subject} />
      <Field label="Цвет">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <TextField label="Преподаватель" value={teacher} onValue={setTeacher} placeholder="Иванов И. И." />
      <TextField label="Аудитория" value={room} onValue={setRoom} placeholder="Обычная аудитория" />
      <Field label="Корпус (место)" hint="Для расчёта дороги. Места настраиваются в «Места и дорога».">
        <PlacePicker value={placeId} onChange={setPlaceId} />
      </Field>
      {subject && (
        <List>
          <ListRow title="В архиве" subtitle="Скрыт из выбора, история сохраняется" trailing={<Switch label="Архив" checked={archived} onChange={setArchived} />} />
        </List>
      )}
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!name.trim()} feedback={false} onClick={save}>
          Сохранить
        </Button>
        {subject && (
          <Button variant="danger" block icon="trash" onClick={() => void remove()}>
            Удалить
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

export function openSubjectForm(subject: Subject | null): void {
  openSheet((close) => <SubjectForm subject={subject} close={close} />, { title: subject ? subject.name : 'Новый предмет' });
}

export function SubjectsScreen() {
  const all = [...subjects.all.value].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'ru'));
  return (
    <Page title="Предметы" back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => openSubjectForm(null)}>Новый</Button>}>
      {all.length === 0 ? (
        <EmptyState icon="notes" title="Предметов нет" action={<Button variant="primary" icon="plus" onClick={() => openSubjectForm(null)}>Добавить предмет</Button>} />
      ) : (
        <Section>
          <List>
            {all.map((s) => (
              <ListRow
                key={s.id}
                leading={<span class="color-dot" style={{ background: colorVar(s.color), opacity: s.archived ? 0.4 : 1 }} />}
                title={s.archived ? `${s.name} (архив)` : s.name}
                {...([s.teacher, s.room].filter(Boolean).length ? { subtitle: [s.teacher, s.room].filter(Boolean).join(' · ') } : {})}
                chevron
                onClick={() => openSubjectForm(s)}
              />
            ))}
          </List>
        </Section>
      )}
    </Page>
  );
}
