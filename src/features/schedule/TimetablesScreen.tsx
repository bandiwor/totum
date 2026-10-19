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

function createTimetable(): void {
  const start = startOfWeek(today());
  const t = timetables.add({
    name: `Семестр с ${formatDayMonth(start)}`,
    startDate: start,
    endDate: null,
    cycle: { anchor: start, days: Array.from({ length: 14 }, () => []), weekAligned: true },
  });
  haptic('success');
  navigate(`plan/timetable/${t.id}`);
}

export function TimetablesScreen() {
  const list = sortedTimetables.value;
  const current = timetableFor(today());
  return (
    <Page title="Расписания" back actions={<Button size="sm" variant="ghost" icon="plus" onClick={createTimetable}>Новое</Button>}>
      {list.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Расписания нет"
          text="Создай расписание на семестр: цикл на 1–2 недели (или любое число дней), пары по дням."
          action={<Button variant="primary" icon="plus" onClick={createTimetable}>Создать</Button>}
        />
      ) : (
        <Section>
          <List>
            {list.map((t) => (
              <ListRow
                key={t.id}
                icon="calendar"
                title={t.name}
                subtitle={`с ${formatDayMonth(t.startDate)}${t.endDate ? ` по ${formatDayMonth(t.endDate)}` : ''} · цикл ${t.cycle.days.length} дн.`}
                trailing={t.id === current?.id ? <Badge tone="positive">Действует</Badge> : undefined}
                chevron
                onClick={() => navigate(`plan/timetable/${t.id}`)}
              />
            ))}
          </List>
          <p class="settings__note">Новый семестр — новое расписание с датой начала. Старое остаётся для истории.</p>
        </Section>
      )}
    </Page>
  );
}

function daySummary(day: TemplateLesson[]): string {
  if (day.length === 0) return 'Выходной';
  return [...day]
    .sort((a, b) => a.start - b.start)
    .map((l) => subjects.get(l.subjectId)?.name ?? '?')
    .join(', ');
}

export function TimetableEditor({ params }: RouteProps) {
  const t = timetables.byId(params.id);
  if (!t) return <Page title="Расписание" back><EmptyState icon="calendar" title="Не найдено" /></Page>;

  const remove = async (): Promise<void> => {
    if (await confirm({ title: `Удалить «${t.name}»?`, message: 'Разовые изменения пар останутся, но не будут отображаться.', confirmLabel: 'Удалить', danger: true })) {
      timetables.remove(t.id);
      navigate('plan/timetables', { replace: true });
    }
  };

  const rename = () => void openSheet((close) => <RenameForm t={t} close={close} />, { title: 'Расписание' });

  return (
    <Page title={t.name} back actions={<Button size="sm" variant="ghost" icon="pencil" onClick={rename}>Изм.</Button>}>
      <Section title="Период">
        <div class="ui-row2">
          <Field label="Начало">
            <DateField value={t.startDate} onChange={(d) => d && timetables.update(t.id, { startDate: d })} />
          </Field>
          <Field label="Конец">
            <DateField value={t.endDate} onChange={(d) => timetables.update(t.id, { endDate: d })} />
          </Field>
        </div>
      </Section>
      <CycleEditor
        cycle={t.cycle}
        onChange={(cycle) => timetables.update(t.id, { cycle })}
        makeDay={() => []}
        summary={(day) => daySummary(day)}
        onOpenDay={(i) => navigate(`plan/timetable/${t.id}/day/${i}`)}
      />
      <Section>
        <Button variant="danger" block icon="trash" onClick={() => void remove()}>
          Удалить расписание
        </Button>
      </Section>
    </Page>
  );
}

function RenameForm({ t, close }: { t: Timetable; close: () => void }) {
  const [name, setName] = useState(t.name);
  return (
    <>
      <TextField label="Название" value={name} onValue={setName} autoFocus />
      <div class="ui-sheet__actions">
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!name.trim()}
          onClick={() => {
            timetables.update(t.id, { name: name.trim() });
            close();
          }}
        >
          Сохранить
        </Button>
        <Button
          block
          icon="copy"
          onClick={() => {
            const copy = timetables.add({
              name: `${t.name} (копия)`,
              startDate: addMonths(t.startDate, 6),
              endDate: null,
              cycle: { ...t.cycle, days: t.cycle.days.map((d) => d.map((l) => ({ ...l, id: newId() }))) },
            });
            close();
            navigate(`plan/timetable/${copy.id}`);
          }}
        >
          Копировать как новый семестр
        </Button>
      </div>
    </>
  );
}

export function TimetableDayEditor({ params }: RouteProps) {
  const t = timetables.byId(params.id);
  const index = Number(params.index);
  const day = t?.cycle.days[index];
  if (!t || !day) return <Page title="День" back><EmptyState icon="calendar" title="Не найдено" /></Page>;

  const setDay = (next: TemplateLesson[]): void => {
    const days = t.cycle.days.map((d, i) => (i === index ? next : d));
    timetables.update(t.id, { cycle: { ...t.cycle, days } });
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
      { title: lesson ? 'Пара' : 'Новая пара' },
    );
  };

  const sorted = [...day].sort((a, b) => a.start - b.start);
  return (
    <Page title={cycleDayLabel(t.cycle, index)} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => openForm(null)}>Пара</Button>}>
      {sorted.length === 0 ? (
        <EmptyState icon="sparkles" title="Выходной" action={<Button variant="primary" icon="plus" onClick={() => openForm(null)}>Добавить пару</Button>} />
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
                  title={s?.name ?? 'Предмет удалён'}
                  subtitle={[type?.name, l.room ?? s?.room, l.online ? 'онлайн' : null].filter(Boolean).join(' · ')}
                  value={`${formatTime(l.start)}–${formatTime(l.end)}`}
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
