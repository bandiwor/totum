import { useState } from 'preact/hooks';
import { cycleDayLabel } from '@/core/cycle';
import { addMonths, formatDayMonth, formatTime, startOfWeek, today } from '@/core/date';
import { haptic } from '@/core/haptics';
import { newId } from '@/core/id';
import { navigate } from '@/core/router';
import type { RouteProps } from '@/core/registry';
import {
  Badge,
  Button,
  colorVar,
  confirm,
  CycleEditor,
  DateField,
  EmptyState,
  Field,
  List,
  ListRow,
  openSheet,
  Page,
  Section,
  TextField,
} from '@/ui';
import { defaultLesson, LessonForm } from './LessonForm';
import { subjects, sortedTimetables, timetableFor, timetables, lessonTypes, type TemplateLesson, type Timetable } from './model';
import { t } from '@/core/i18n';

function createTimetable(): void {
  const start = startOfWeek(today());
  const tt = timetables.add({
    name: t('schedule.semesterFrom', { date: formatDayMonth(start) }),
    startDate: start,
    endDate: null,
    cycle: { anchor: start, days: Array.from({ length: 14 }, () => []), weekAligned: true },
  });
  haptic('success');
  navigate(`plan/timetable/${tt.id}`);
}

export function TimetablesScreen() {
  const list = sortedTimetables.value;
  const current = timetableFor(today());
  return (
    <Page title={t('schedule.timetables')} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={createTimetable}>{t('schedule.newTimetable')}</Button>}>
      {list.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={t('schedule.noTimetables')}
          text={t('schedule.noTimetablesText')}
          action={<Button variant="primary" icon="plus" onClick={createTimetable}>{t('schedule.create')}</Button>}
        />
      ) : (
        <Section>
          <List>
            {list.map((tt) => (
              <ListRow
                key={tt.id}
                icon="calendar"
                title={tt.name}
                subtitle={t('schedule.timetableSub', { from: formatDayMonth(tt.startDate), to: tt.endDate ? t('schedule.timetableTo', { date: formatDayMonth(tt.endDate) }) : '', days: tt.cycle.days.length })}
                trailing={tt.id === current?.id ? <Badge tone="positive">{t('schedule.active')}</Badge> : undefined}
                chevron
                onClick={() => navigate(`plan/timetable/${tt.id}`)}
              />
            ))}
          </List>
          <p class="settings__note">{t('schedule.timetablesHint')}</p>
        </Section>
      )}
    </Page>
  );
}

function daySummary(day: TemplateLesson[]): string {
  if (day.length === 0) return t('schedule.dayOff');
  return [...day]
    .sort((a, b) => a.start - b.start)
    .map((l) => subjects.get(l.subjectId)?.name ?? '?')
    .join(', ');
}

export function TimetableEditor({ params }: RouteProps) {
  const tt = timetables.byId(params.id);
  if (!tt) return <Page title={t('schedule.timetable')} back><EmptyState icon="calendar" title={t('common.notFound')} /></Page>;

  const remove = async (): Promise<void> => {
    if (await confirm({ title: t('schedule.deleteNamed', { name: tt.name }), message: t('schedule.deleteTimetableText'), confirmLabel: t('common.delete'), danger: true })) {
      timetables.remove(tt.id);
      navigate('plan/timetables', { replace: true });
    }
  };

  const rename = () => void openSheet((close) => <RenameForm tt={tt} close={close} />, { title: t('schedule.timetable') });

  return (
    <Page title={tt.name} back actions={<Button size="sm" variant="ghost" icon="pencil" onClick={rename}>{t('common.edit')}</Button>}>
      <Section title={t('schedule.period')}>
        <div class="ui-row2">
          <Field label={t('common.start')}>
            <DateField value={tt.startDate} onChange={(d) => d && timetables.update(tt.id, { startDate: d })} />
          </Field>
          <Field label={t('common.end')}>
            <DateField value={tt.endDate} onChange={(d) => timetables.update(tt.id, { endDate: d })} />
          </Field>
        </div>
      </Section>
      <CycleEditor
        cycle={tt.cycle}
        onChange={(cycle) => timetables.update(tt.id, { cycle })}
        makeDay={() => []}
        summary={(day) => daySummary(day)}
        onOpenDay={(i) => navigate(`plan/timetable/${tt.id}/day/${i}`)}
      />
      <Section>
        <Button variant="danger" block icon="trash" onClick={() => void remove()}>
          {t('schedule.deleteTimetable')}
        </Button>
      </Section>
    </Page>
  );
}

function RenameForm({ tt, close }: { tt: Timetable; close: () => void }) {
  const [name, setName] = useState(tt.name);
  return (
    <>
      <TextField label={t('common.name')} value={name} onValue={setName} autoFocus />
      <div class="ui-sheet__actions">
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!name.trim()}
          onClick={() => {
            timetables.update(tt.id, { name: name.trim() });
            close();
          }}
        >
          {t('common.save')}
        </Button>
        <Button
          block
          icon="copy"
          onClick={() => {
            const copy = timetables.add({
              name: t('schedule.copySuffix', { name: tt.name }),
              startDate: addMonths(tt.startDate, 6),
              endDate: null,
              cycle: { ...tt.cycle, days: tt.cycle.days.map((d) => d.map((l) => ({ ...l, id: newId() }))) },
            });
            close();
            navigate(`plan/timetable/${copy.id}`);
          }}
        >
          {t('schedule.copyAsNew')}
        </Button>
      </div>
    </>
  );
}

export function TimetableDayEditor({ params }: RouteProps) {
  const tt = timetables.byId(params.id);
  const index = Number(params.index);
  const day = tt?.cycle.days[index];
  if (!tt || !day) return <Page title={t('schedule.day')} back><EmptyState icon="calendar" title={t('common.notFound')} /></Page>;

  const setDay = (next: TemplateLesson[]): void => {
    const days = tt.cycle.days.map((d, i) => (i === index ? next : d));
    timetables.update(tt.id, { cycle: { ...tt.cycle, days } });
  };

  const openForm = (lesson: TemplateLesson | null): void => {
    const last = [...day].sort((a, b) => b.end - a.end)[0];
    const base = defaultLesson();
    openSheet(
      (close) => (
        <LessonForm
          initial={lesson ?? (last ? { ...base, start: last.end + 10, end: last.end + 10 + (base.end - base.start), bell: last.bell !== null ? last.bell + 1 : null } : base)}
          onSave={(data) => (lesson ? setDay(day.map((l) => (l.id === lesson.id ? { ...data, id: l.id } : l))) : setDay([...day, { ...data, id: newId() }]))}
          {...(lesson ? { onDelete: () => setDay(day.filter((l) => l.id !== lesson.id)) } : {})}
          close={close}
        />
      ),
      { title: lesson ? t('schedule.lesson') : t('schedule.newLesson') },
    );
  };

  const sorted = [...day].sort((a, b) => a.start - b.start);
  return (
    <Page title={cycleDayLabel(tt.cycle, index)} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => openForm(null)}>{t('schedule.lesson')}</Button>}>
      {sorted.length === 0 ? (
        <EmptyState icon="sparkles" title={t('schedule.dayOff')} action={<Button variant="primary" icon="plus" onClick={() => openForm(null)}>{t('schedule.addLesson')}</Button>} />
      ) : (
        <Section>
          <List>
            {sorted.map((l) => {
              const s = subjects.get(l.subjectId);
              const type = l.typeId ? lessonTypes.get(l.typeId) : undefined;
              return (
                <ListRow
                  key={l.id}
                  leading={<span class="color-dot" style={{ background: colorVar(s?.color ?? 'c8') }} />}
                  title={s?.name ?? t('schedule.deletedSubject')}
                  subtitle={[type?.name, l.room ?? s?.room, l.online ? t('schedule.onlineLower') : null].filter(Boolean).join(' · ')}
                  value={t('time.range', { from: formatTime(l.start), to: formatTime(l.end) })}
                  onClick={() => openForm(l)}
                />
              );
            })}
          </List>
        </Section>
      )}
    </Page>
  );
}
