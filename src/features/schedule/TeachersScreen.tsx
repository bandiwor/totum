import { batch } from '@preact/signals';
import { useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { Button, ChoiceChips, confirm, EmptyState, Form, List, ListRow, openSheet, Page, Section, SheetActions, TextField } from '@/ui';
import { lessonOverrides, sortedTeachers, subjects, teachers, timetables, type Teacher } from './model';

export const teacherLine = (teacher: Teacher): string => (teacher.position ? `${teacher.name} · ${teacher.position}` : teacher.name);

/** Unlinks a deleted teacher from subjects, timetable lessons and one-date changes. */
function unlink(id: string): void {
  batch(() => {
    for (const s of subjects.all.value) if (s.teacherId === id) subjects.update(s.id, { teacherId: null });
    for (const tt of timetables.all.value) {
      if (!tt.cycle.days.some((day) => day.some((l) => l.teacherId === id))) continue;
      timetables.update(tt.id, { cycle: { ...tt.cycle, days: tt.cycle.days.map((day) => day.map((l) => (l.teacherId === id ? { ...l, teacherId: null } : l))) } });
    }
    for (const r of lessonOverrides.collection.all.value) {
      if (r.data?.teacherId === id) lessonOverrides.collection.update(r.id, { data: { ...r.data, teacherId: null } });
      if (r.patch?.teacherId === id) lessonOverrides.collection.update(r.id, { patch: { ...r.patch, teacherId: null } });
    }
  });
}

function TeacherForm({ teacher, onSaved, close }: { teacher: Teacher | null; onSaved?: (t: Teacher) => void; close: () => void }) {
  const [name, setName] = useState(teacher?.name ?? '');
  const [position, setPosition] = useState(teacher?.position ?? '');

  const save = (): void => {
    const data = { name: name.trim(), position: position.trim() };
    if (!data.name) return;
    const saved = teacher ? teachers.update(teacher.id, data) : teachers.add(data);
    haptic('success');
    if (saved) onSaved?.(saved);
    close();
  };

  return (
    <Form>
      <TextField label={t('schedule.teacherName')} value={name} onValue={setName} placeholder={t('schedule.teacherPlaceholder')} autoFocus={!teacher} />
      <TextField label={t('schedule.position')} value={position} onValue={setPosition} placeholder={t('schedule.positionPlaceholder')} />
      <SheetActions>
        <Button variant="primary" size="lg" block disabled={!name.trim()} feedback={false} onClick={save}>
          {t('common.save')}
        </Button>
        {teacher && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={async () => {
              if (!(await confirm({ title: t('schedule.deleteNamed', { name: teacher.name }), message: t('schedule.deleteTeacherText'), confirmLabel: t('common.delete'), danger: true }))) return;
              unlink(teacher.id);
              teachers.remove(teacher.id);
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

export function openTeacherForm(teacher: Teacher | null, onSaved?: (t: Teacher) => void): void {
  void openSheet((close) => <TeacherForm teacher={teacher} {...(onSaved ? { onSaved } : {})} close={close} />, { title: teacher ? teacher.name : t('schedule.newTeacher') });
}

/**
 * Pick a teacher, or add a new one right here. `noneLabel` names the empty
 * choice: "not set" for a subject, "as in the subject" for a lesson.
 */
export function TeacherPicker({ value, onChange, noneLabel }: { value: string | null; onChange: (id: string | null) => void; noneLabel: string }) {
  const options = [{ value: '', label: noneLabel }, ...sortedTeachers.value.map((x) => ({ value: x.id, label: x.name })), { value: '+', label: t('schedule.addTeacherChip') }];
  return (
    <ChoiceChips
      options={options}
      value={value ?? ''}
      onChange={(v) => {
        if (v === '+') openTeacherForm(null, (created) => onChange(created.id));
        else onChange(v ? v : null);
      }}
    />
  );
}

export function TeachersScreen() {
  const list = sortedTeachers.value;
  const subjectsOf = (id: string): string =>
    subjects.all.value
      .filter((s) => s.teacherId === id && !s.archived)
      .map((s) => s.name)
      .join(', ');
  return (
    <Page title={t('schedule.teachers')} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => openTeacherForm(null)}>{t('common.newM')}</Button>}>
      {list.length === 0 ? (
        <EmptyState icon="notes" title={t('schedule.noTeachers')} text={t('schedule.noTeachersText')} action={<Button variant="primary" icon="plus" onClick={() => openTeacherForm(null)}>{t('schedule.newTeacher')}</Button>} />
      ) : (
        <Section>
          <List>
            {list.map((x) => {
              const subs = subjectsOf(x.id);
              return <ListRow key={x.id} title={x.name} subtitle={[x.position, subs].filter(Boolean).join(' · ') || t('schedule.positionNone')} chevron onClick={() => openTeacherForm(x)} />;
            })}
          </List>
        </Section>
      )}
    </Page>
  );
}
