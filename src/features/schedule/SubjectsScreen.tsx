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
import { subjects, teachers, timetables, type Subject } from './model';
import { TeacherPicker } from './TeachersScreen';
import { t } from '@/core/i18n';

function isUsed(id: string): boolean {
  return timetables.all.value.some((t) => t.cycle.days.some((day) => day.some((l) => l.subjectId === id)));
}

function SubjectForm({ subject, close }: { subject: Subject | null; close: () => void }) {
  const [name, setName] = useState(subject?.name ?? '');
  const [color, setColor] = useState(subject?.color ?? (`c${(subjects.all.value.length % 8) + 1}` as ColorKey));
  const [teacherId, setTeacherId] = useState(subject?.teacherId ?? null);
  const [room, setRoom] = useState(subject?.room ?? '');
  const [placeId, setPlaceId] = useState(subject?.placeId ?? null);
  const [archived, setArchived] = useState(subject?.archived ?? false);

  const save = (): void => {
    const data = { name: name.trim(), color, teacherId, room: room.trim(), placeId, archived };
    if (!data.name) return;
    if (subject) subjects.update(subject.id, data);
    else subjects.add(data);
    haptic('success');
    close();
  };

  const remove = async (): Promise<void> => {
    if (!subject) return;
    if (isUsed(subject.id)) {
      await confirm({ title: t('schedule.subjectInUse'), message: t('schedule.subjectInUseText'), confirmLabel: t('common.understood') });
      return;
    }
    if (await confirm({ title: t('schedule.deleteNamed', { name: subject.name }), confirmLabel: t('common.delete'), danger: true })) {
      subjects.remove(subject.id);
      close();
    }
  };

  return (
    <Form>
      <TextField label={t('common.name')} value={name} onValue={setName} placeholder={t('schedule.subjectPlaceholder')} autoFocus={!subject} />
      <Field label={t('common.color')}>
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Field label={t('schedule.teacher')} hint={t('schedule.teacherHint')}>
        <TeacherPicker value={teacherId} onChange={setTeacherId} noneLabel={t('schedule.teacherNone')} />
      </Field>
      <TextField label={t('schedule.room')} value={room} onValue={setRoom} placeholder={t('schedule.roomPlaceholder')} />
      <Field label={t('schedule.building')} hint={t('schedule.buildingHint')}>
        <PlacePicker value={placeId} onChange={setPlaceId} />
      </Field>
      {subject && (
        <List>
          <ListRow title={t('common.archived')} subtitle={t('schedule.archivedHint')} trailing={<Switch label={t('common.archive')} checked={archived} onChange={setArchived} />} />
        </List>
      )}
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!name.trim()} feedback={false} onClick={save}>
          {t('common.save')}
        </Button>
        {subject && (
          <Button variant="danger" block icon="trash" onClick={() => void remove()}>
            {t('common.delete')}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

export function openSubjectForm(subject: Subject | null): void {
  openSheet((close) => <SubjectForm subject={subject} close={close} />, { title: subject ? subject.name : t('schedule.newSubject') });
}

export function SubjectsScreen() {
  const all = [...subjects.all.value].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'ru'));
  return (
    <Page title={t('schedule.subjects')} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => openSubjectForm(null)}>{t('common.newM')}</Button>}>
      {all.length === 0 ? (
        <EmptyState icon="notes" title={t('schedule.noSubjects')} action={<Button variant="primary" icon="plus" onClick={() => openSubjectForm(null)}>{t('schedule.addSubject')}</Button>} />
      ) : (
        <Section>
          <List>
            {all.map((s) => (
              <ListRow
                key={s.id}
                leading={<span class="color-dot" style={{ background: colorVar(s.color), opacity: s.archived ? 0.4 : 1 }} />}
                title={s.archived ? t('common.archivedSuffix', { name: s.name }) : s.name}
                {...([teachers.get(s.teacherId ?? '')?.name, s.room].filter(Boolean).length ? { subtitle: [teachers.get(s.teacherId ?? '')?.name, s.room].filter(Boolean).join(' · ') } : {})}
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
