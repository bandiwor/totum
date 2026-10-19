import { formatDayMonth, formatTime, nowMinutes, today } from '@/core/date';
import { haptic } from '@/core/haptics';
import { navigate } from '@/core/router';
import { Badge, Button, Card, colorVar, EmptyState, List, ListRow, openSheet, Page, Section } from '@/ui';
import { startSession } from './actions';
import { openAddWorkout, openWorkoutSlot } from './ProgramScreens';
import { activeSession, plannedWorkouts, sessionForSlot, sessionsByDate, templates, wellbeingLabel, type WorkoutSession } from './model';
import { t } from '@/core/i18n';

function sessionSubtitle(s: WorkoutSession): string {
  const sets = s.exercises.reduce((n, x) => n + x.sets.filter((set) => set.done).length, 0);
  return [formatDayMonth(s.date), t('training.sessionSub', { sets }), s.wellbeing ? wellbeingLabel(s.wellbeing) : null].filter(Boolean).join(' · ');
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
      {templates.all.value.map((tpl) => (
        <ListRow key={tpl.id} leading={<span class="color-dot" style={{ background: colorVar(tpl.color) }} />} title={tpl.name} subtitle={t('training.exercisesCount', { n: tpl.exercises.length })} chevron onClick={() => go(tpl.id)} />
      ))}
      <ListRow icon="plus" title={t('training.freeWorkout')} subtitle={t('training.freeWorkoutHint')} chevron onClick={() => go(null)} />
    </List>
  );
}

export function openStartNow(): void {
  void openSheet((close) => <StartNowList close={close} />, { title: t('training.startNow') });
}

export function TodayWorkouts() {
  const date = today();
  const planned = plannedWorkouts(date);
  if (planned.length === 0) {
    return (
      <Card>
        <p class="training__rest">{t('training.restToday')}</p>
        <div class="training__actions">
          <Button size="sm" variant="primary" icon="dumbbell" onClick={openStartNow}>
            {t('training.startNow')}
          </Button>
          <Button size="sm" icon="calendar" onClick={() => openAddWorkout(date)}>
            {t('training.schedule')}
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
            title={p.template?.name ?? t('training.workout')}
            subtitle={t('time.range', { from: formatTime(p.data.start), to: formatTime(p.data.end) })}
            trailing={s ? <Badge tone={s.finished ? 'positive' : 'accent'}>{s.finished ? t('training.done') : t('training.inProgress')}</Badge> : <Badge>{t('training.start')}</Badge>}
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
          <p class="training__active-label">{t('training.active')}</p>
          <p class="training__active-title">{active.title}</p>
        </Card>
      )}
      <Section title={t('training.today')}>
        <TodayWorkouts />
      </Section>
      <Section>
        <List>
          <ListRow icon="calendar" title={t('training.program')} subtitle={t('training.programSub')} chevron onClick={() => navigate('health/program')} />
          <ListRow icon="dumbbell" title={t('training.workouts')} subtitle={t('training.workoutsSub')} chevron onClick={() => navigate('health/templates')} />
          <ListRow icon="tasks" title={t('training.exercises')} subtitle={t('training.exercisesSub')} chevron onClick={() => navigate('health/exercises')} />
          <ListRow icon="scale" title={t('training.progress')} subtitle={t('training.progressSub')} chevron onClick={() => navigate('health/progress')} />
        </List>
      </Section>
      <Section title={t('training.recent')} action={recent.length ? <Button size="sm" variant="ghost" onClick={() => navigate('health/history')}>{t('common.all')}</Button> : undefined}>
        {recent.length === 0 ? (
          <p class="widget-empty">{t('training.emptyLog')}</p>
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
    <Page title={t('training.log')} back>
      {list.length === 0 ? (
        <EmptyState icon="dumbbell" title={t('training.noSessions')} />
      ) : (
        <Section>
          <List>
            {list.map((s) => (
              <ListRow
                key={s.id}
                icon="dumbbell"
                title={s.title}
                subtitle={sessionSubtitle(s)}
                trailing={s.finished ? undefined : <Badge tone="accent">{t('training.inProgress')}</Badge>}
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
