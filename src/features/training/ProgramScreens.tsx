import { useState } from 'preact/hooks';
import { cycleDayIndex, cycleDayLabel } from '@/core/cycle';
import { formatRelativeDay, formatTime, nowMinutes, startOfWeek, today, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { newId } from '@/core/id';
import type { RouteProps } from '@/core/registry';
import { navigate } from '@/core/router';
import { PlacePicker } from '@/features/places/PlacePicker';
import { Badge, Button, ChoiceChips, colorVar, CycleEditor, EmptyState, Field, Form, List, ListRow, openSheet, Page, Section, SheetActions, TimeRange } from '@/ui';
import { startSession } from './actions';
import { formatTarget, exercises, plannedWorkouts, cancelledWorkouts, program, sessionForSlot, templates, workoutOverrides, type SlotData, type TemplateSlot } from './model';

function SlotForm({ initial, onSave, onDelete, saveLabel = 'Сохранить', close }: { initial: SlotData; onSave: (d: SlotData) => void; onDelete?: () => void; saveLabel?: string; close: () => void }) {
  const [d, setD] = useState(initial);
  const list = templates.all.value;
  if (list.length === 0) {
    return (
      <EmptyState
        icon="dumbbell"
        title="Сначала создай тренировку"
        action={<Button variant="primary" onClick={() => { close(); navigate('health/templates'); }}>К тренировкам</Button>}
      />
    );
  }
  return (
    <Form>
      <Field label="Тренировка">
        <ChoiceChips
          options={list.map((t) => ({ value: t.id, label: t.name, color: colorVar(t.color) }))}
          value={d.templateId}
          onChange={(templateId) => {
            if (!templateId) return;
            const dur = templates.get(templateId)?.duration ?? 60;
            setD({ ...d, templateId, end: Math.min(1440, d.start + dur) });
          }}
        />
      </Field>
      <TimeRange start={d.start} end={d.end} onChange={(start, end) => setD({ ...d, start, end })} />
      <Field label="Где" hint="Для расчёта дороги">
        <PlacePicker value={d.placeId} onChange={(placeId) => setD({ ...d, placeId })} noneLabel="Дома / без дороги" />
      </Field>
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!d.templateId || d.end <= d.start}
          feedback={false}
          onClick={() => {
            haptic('success');
            onSave(d);
            close();
          }}
        >
          {saveLabel}
        </Button>
        {onDelete && (
          <Button variant="danger" block icon="trash" onClick={() => { onDelete(); close(); }}>
            Удалить
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

function defaultSlot(): SlotData {
  const t = templates.all.value[0];
  const last = program.value.value.cycle?.days.flat().at(-1);
  return { templateId: t?.id ?? '', start: 18 * 60, end: 18 * 60 + (t?.duration ?? 75), placeId: last?.placeId ?? null };
}

export function ProgramScreen() {
  const cycle = program.value.value.cycle;
  const create = (): void => {
    program.set({ cycle: { anchor: startOfWeek(today()), days: Array.from({ length: 7 }, () => []), weekAligned: true } });
    haptic('success');
  };
  return (
    <Page title="Программа" back>
      {!cycle ? (
        <EmptyState
          icon="calendar"
          title="Программы нет"
          text="Программа ставит тренировки по дням недели или циклом на любое число дней (например, 3 дня через 1)."
          action={<Button variant="primary" icon="plus" onClick={create}>Создать</Button>}
        />
      ) : (
        <>
          <CycleEditor
            cycle={cycle}
            onChange={(c) => program.set({ cycle: c })}
            makeDay={() => []}
            summary={(day) =>
              day.length
                ? [...day].sort((a, b) => a.start - b.start).map((s) => `${templates.get(s.templateId)?.name ?? '?'} ${formatTime(s.start)}`).join(', ')
                : 'Отдых'
            }
            onOpenDay={(i) => navigate(`health/program/day/${i}`)}
            title="Дни программы"
          />
          <Section>
            <Button block variant="ghost" onClick={() => navigate('health/templates')}>
              Тренировки и упражнения в них
            </Button>
          </Section>
        </>
      )}
    </Page>
  );
}

export function ProgramDayScreen({ params }: RouteProps) {
  const cycle = program.value.value.cycle;
  const index = Number(params.index);
  const day = cycle?.days[index];
  if (!cycle || !day) return <Page title="День" back><EmptyState icon="calendar" title="Не найдено" /></Page>;

  const setDay = (next: TemplateSlot[]): void => program.set({ cycle: { ...cycle, days: cycle.days.map((d, i) => (i === index ? next : d)) } });
  const open = (slot: TemplateSlot | null): void =>
    void openSheet(
      (close) => (
        <SlotForm
          initial={slot ?? defaultSlot()}
          onSave={(data) => (slot ? setDay(day.map((s) => (s.id === slot.id ? { ...data, id: s.id } : s))) : setDay([...day, { ...data, id: newId() }]))}
          {...(slot ? { onDelete: () => setDay(day.filter((s) => s.id !== slot.id)) } : {})}
          close={close}
        />
      ),
      { title: slot ? 'Тренировка' : 'Добавить тренировку' },
    );

  return (
    <Page title={cycleDayLabel(cycle, index)} back actions={<Button size="sm" variant="ghost" icon="plus" onClick={() => open(null)}>Добавить</Button>}>
      {day.length === 0 ? (
        <EmptyState icon="sparkles" title="День отдыха" action={<Button variant="primary" icon="plus" onClick={() => open(null)}>Добавить тренировку</Button>} />
      ) : (
        <Section>
          <List>
            {[...day].sort((a, b) => a.start - b.start).map((s) => {
              const t = templates.get(s.templateId);
              return (
                <ListRow
                  key={s.id}
                  leading={<span class="color-dot" style={{ background: colorVar(t?.color ?? 'c8') }} />}
                  title={t?.name ?? 'Удалена'}
                  value={`${formatTime(s.start)}–${formatTime(s.end)}`}
                  onClick={() => open(s)}
                />
              );
            })}
          </List>
        </Section>
      )}
    </Page>
  );
}

// ── Dated workouts (timeline / day actions) ────────────────────────────────

function SlotDetails({ date, slotKey, close }: { date: ISODate; slotKey: string; close: () => void }) {
  const planned = plannedWorkouts(date).find((p) => p.key === slotKey);
  const cancelled = !planned ? cancelledWorkouts(date).find((p) => p.key === slotKey) : undefined;
  const w = planned ?? cancelled;
  if (!w) return null;
  const session = sessionForSlot(date, slotKey);
  const cycle = program.value.value.cycle;

  const begin = (): void => {
    const s = startSession({ template: w.template, date, slotKey, start: date === today() ? nowMinutes() : w.data.start });
    close();
    navigate(`health/session/${s.id}`);
  };

  return (
    <>
      <p class="sheet-note">
        {formatRelativeDay(date)} · {formatTime(w.data.start)}–{formatTime(w.data.end)}{' '}
        {cancelled && <Badge tone="danger">Отменена</Badge>}
        {w.modified && <Badge tone="warning">Изменена</Badge>}
        {w.origin === 'added' && <Badge tone="accent">Разовая</Badge>}
      </p>
      {w.template && w.template.exercises.length > 0 && (
        <List>
          {w.template.exercises.map((p) => {
            const e = exercises.get(p.exerciseId);
            return <ListRow key={p.id} title={e?.name ?? '—'} subtitle={e ? formatTarget(p, e.measure) : ''} />;
          })}
        </List>
      )}
      <SheetActions>
        {!cancelled &&
          (session ? (
            <Button variant="primary" size="lg" block icon="dumbbell" onClick={() => { close(); navigate(`health/session/${session.id}`); }}>
              {session.finished ? 'Открыть запись' : 'Продолжить'}
            </Button>
          ) : (
            <Button variant="primary" size="lg" block icon="dumbbell" onClick={begin}>
              Начать тренировку
            </Button>
          ))}
        {(cancelled || w.modified) && (
          <Button block icon="history" onClick={() => { workoutOverrides.reset(date, slotKey); haptic('success'); }}>
            Вернуть как в программе
          </Button>
        )}
        {!cancelled && (
          <Button
            block
            icon="pencil"
            onClick={() =>
              openSheet(
                (c) => <SlotForm initial={w.data} saveLabel="Сохранить на этот день" onSave={(data) => workoutOverrides.modify(date, slotKey, data)} close={c} />,
                { title: 'Только этот день' },
              )
            }
          >
            Изменить только этот день
          </Button>
        )}
        {!cancelled && !session && (
          <Button
            block
            variant="danger"
            icon="x"
            onClick={() => {
              workoutOverrides.cancel(date, slotKey);
              haptic('warning');
              if (w.origin === 'added') close();
            }}
          >
            {w.origin === 'added' ? 'Удалить разовую' : 'Пропустить'}
          </Button>
        )}
        {cycle && w.origin === 'template' && (
          <Button block variant="ghost" onClick={() => { close(); navigate(`health/program/day/${cycleDayIndex(cycle, date)}`); }}>
            Изменить в программе
          </Button>
        )}
      </SheetActions>
    </>
  );
}

export function openWorkoutSlot(date: ISODate, id: string): void {
  if (id.startsWith('session:')) {
    navigate(`health/session/${id.slice('session:'.length)}`);
    return;
  }
  const w = plannedWorkouts(date).find((p) => p.key === id) ?? cancelledWorkouts(date).find((p) => p.key === id);
  void openSheet((close) => <SlotDetails date={date} slotKey={id} close={close} />, { title: w?.template?.name ?? 'Тренировка' });
}

export function openAddWorkout(date: ISODate): void {
  void openSheet(
    (close) => <SlotForm initial={defaultSlot()} saveLabel="Добавить на этот день" onSave={(data) => workoutOverrides.add(date, data)} close={close} />,
    { title: 'Разовая тренировка' },
  );
}
