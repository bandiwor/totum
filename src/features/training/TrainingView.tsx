import { formatDayMonth, formatTime, nowMinutes, today } from '@/core/date';
import { haptic } from '@/core/haptics';
import { navigate } from '@/core/router';
import { Badge, Button, Card, colorVar, EmptyState, List, ListRow, openSheet, Page, Section } from '@/ui';
import { startSession } from './actions';
import { openAddWorkout, openWorkoutSlot } from './ProgramScreens';
import { activeSession, plannedWorkouts, sessionForSlot, sessionsByDate, templates, WELLBEING_LABELS, type WorkoutSession } from './model';

function sessionSubtitle(s: WorkoutSession): string {
  const sets = s.exercises.reduce((n, x) => n + x.sets.filter((set) => set.done).length, 0);
  return [`${formatDayMonth(s.date)}`, `${sets} подх.`, s.wellbeing ? WELLBEING_LABELS[s.wellbeing - 1] : null].filter(Boolean).join(' · ');
}

/** Pick a template (or none) and start right now. */
export function StartNowList({ close }: { close: () => void }) {
  const go = (templateId: string | null): void => {
    const s = startSession({ template: templateId ? templates.get(templateId) : undefined, start: nowMinutes() });
    haptic('success');
    close();
    navigate(`health/session/${s.id}`);
  };
  return (
    <List>
      {templates.all.value.map((t) => (
        <ListRow key={t.id} leading={<span class="color-dot" style={{ background: colorVar(t.color) }} />} title={t.name} subtitle={`${t.exercises.length} упр.`} chevron onClick={() => go(t.id)} />
      ))}
      <ListRow icon="plus" title="Свободная тренировка" subtitle="Упражнения добавишь по ходу" chevron onClick={() => go(null)} />
    </List>
  );
}

export function openStartNow(): void {
  void openSheet((close) => <StartNowList close={close} />, { title: 'Начать сейчас' });
}

export function TodayWorkouts() {
  const date = today();
  const planned = plannedWorkouts(date);
  if (planned.length === 0) {
    return (
      <Card>
        <p class="training__rest">Сегодня по программе отдых</p>
        <div class="training__actions">
          <Button size="sm" variant="primary" icon="dumbbell" onClick={openStartNow}>
            Начать сейчас
          </Button>
          <Button size="sm" icon="calendar" onClick={() => openAddWorkout(date)}>
            Запланировать
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <List>
      {planned.map((p) => {
        const s = sessionForSlot(date, p.key);
        return (
          <ListRow
            key={p.key}
            leading={<span class="color-dot" style={{ background: colorVar(p.template?.color ?? 'c8') }} />}
            title={p.template?.name ?? 'Тренировка'}
            subtitle={`${formatTime(p.data.start)}–${formatTime(p.data.end)}`}
            trailing={s ? <Badge tone={s.finished ? 'positive' : 'accent'}>{s.finished ? 'Готово' : 'Идёт'}</Badge> : <Badge>Начать</Badge>}
            chevron
            onClick={() => openWorkoutSlot(date, p.key)}
          />
        );
      })}
    </List>
  );
}

export function TrainingView() {
  const active = activeSession.value;
  const recent = sessionsByDate.value.filter((s) => s.finished).slice(0, 3);
  return (
    <>
      {active && (
        <Card onClick={() => navigate(`health/session/${active.id}`)} class="training__active">
          <p class="training__active-label">Идёт тренировка</p>
          <p class="training__active-title">{active.title}</p>
        </Card>
      )}
      <Section title="Сегодня">
        <TodayWorkouts />
      </Section>
      <Section>
        <List>
          <ListRow icon="calendar" iconColor="var(--c-1)" title="Программа" subtitle="Какие тренировки в какие дни" chevron onClick={() => navigate('health/program')} />
          <ListRow icon="dumbbell" iconColor="var(--c-2)" title="Тренировки" subtitle="Упражнения, подходы, веса, прогрессия" chevron onClick={() => navigate('health/templates')} />
          <ListRow icon="tasks" iconColor="var(--c-5)" title="Упражнения" subtitle="Библиотека и категории" chevron onClick={() => navigate('health/exercises')} />
          <ListRow icon="scale" iconColor="var(--c-3)" title="Прогресс" subtitle="Графики и тренды" chevron onClick={() => navigate('health/progress')} />
        </List>
      </Section>
      <Section title="Последние" action={recent.length ? <Button size="sm" variant="ghost" onClick={() => navigate('health/history')}>Все</Button> : undefined}>
        {recent.length === 0 ? (
          <p class="widget-empty">Журнал пуст.</p>
        ) : (
          <List>
            {recent.map((s) => (
              <ListRow key={s.id} icon="dumbbell" title={s.title} subtitle={sessionSubtitle(s)} chevron onClick={() => navigate(`health/session/${s.id}`)} />
            ))}
          </List>
        )}
      </Section>
    </>
  );
}

export function HistoryScreen() {
  const list = sessionsByDate.value;
  return (
    <Page title="Журнал" back>
      {list.length === 0 ? (
        <EmptyState icon="dumbbell" title="Тренировок ещё не было" />
      ) : (
        <Section>
          <List>
            {list.map((s) => (
              <ListRow
                key={s.id}
                icon="dumbbell"
                title={s.title}
                subtitle={sessionSubtitle(s)}
                trailing={s.finished ? undefined : <Badge tone="accent">Идёт</Badge>}
                chevron
                onClick={() => navigate(`health/session/${s.id}`)}
              />
            ))}
          </List>
        </Section>
      )}
    </Page>
  );
}
