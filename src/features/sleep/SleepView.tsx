import { useState } from 'preact/hooks';
import { addDays, formatDayMonth, formatDuration, formatTime, nowMinutes, today, type ISODate, type Minutes } from '@/core/date';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import type { QuickActionContext } from '@/core/registry';
import { settings } from '@/core/settings';
import { DayWindowForm } from '@/features/plan/SetupList';
import { BarChart, Button, Card, DateField, EmptyState, Form, List, ListRow, openSheet, Section, SheetActions, Stat, TimeField } from '@/ui';
import {
  clockOf,
  dateOf,
  dayOf,
  fromClock,
  goToBed,
  isNight,
  lateness,
  latency,
  openSession,
  plannedDuration,
  recentSessions,
  saveSession,
  sleepDuration,
  sleepLog,
  sleepStats,
  sortedSleep,
  span,
  totalOn,
  typicalLatency,
  type SleepEntry,
} from './model';

const round5 = (m: Minutes): Minutes => (Math.round(m / 5) * 5) % 1440;
const signed = (m: number): string => `${m > 0 ? '+' : m < 0 ? '−' : ''}${formatDuration(Math.abs(m))}`;

/** Finish the session in progress, fix a past one, or add one that wasn't stamped. */
export function SessionForm({ entry, close }: { entry: SleepEntry | null; close: () => void }) {
  const s = settings.value.value;
  const bed0 = entry ? clockOf(entry.bedAt) : s.dayEnd;
  const wake0 = entry?.wakeAt != null ? clockOf(entry.wakeAt) : entry ? nowMinutes() : s.dayStart;
  // Default "fell asleep" = bedtime + usual latency, but never after waking up.
  const asleep0 = entry?.asleepAt != null ? clockOf(entry.asleepAt) : span(bed0, wake0) > typicalLatency.value ? round5(bed0 + typicalLatency.value) : bed0;
  const [bed, setBed] = useState<Minutes>(bed0);
  const [asleep, setAsleep] = useState<Minutes>(asleep0);
  const [wake, setWake] = useState<Minutes>(wake0);
  const [wakeDate, setWakeDate] = useState<ISODate>(entry?.wakeAt != null ? dateOf(entry.wakeAt) : today());

  return (
    <Form>
      <TimeField label={t('sleep.bedAt')} value={bed} onChange={setBed} />
      <TimeField label={t('sleep.asleepAt')} value={asleep} onChange={setAsleep} />
      <TimeField label={t('sleep.wakeAt')} value={wake} onChange={setWake} />
      <DateField label={t('sleep.wakeDate')} value={wakeDate} onChange={(d) => d && setWakeDate(d)} />
      <p class="sheet-note num">{t('sleep.summary', { sleep: formatDuration(span(asleep, wake)), latency: formatDuration(span(bed, asleep)) })}</p>
      {span(bed, wake) > 16 * 60 && <p class="sheet-error">{t('sleep.tooLong')}</p>}
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          feedback="success"
          onClick={() => {
            saveSession(entry?.id ?? null, fromClock(wakeDate, wake, asleep, bed));
            close();
          }}
        >
          {t('common.save')}
        </Button>
        {entry && (
          <Button
            variant="danger"
            block
            icon="trash"
            onClick={() => {
              sleepLog.remove(entry.id);
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

export const openSessionForm = (entry: SleepEntry | null): void =>
  void openSheet((close) => <SessionForm entry={entry} close={close} />, {
    title: entry?.wakeAt === null ? t('sleep.wakeUp') : entry ? t('sleep.session') : t('sleep.addSleep'),
  });

function sessionLine(e: SleepEntry): string {
  return `${formatTime(clockOf(e.bedAt))} → ${e.wakeAt === null ? '…' : formatTime(clockOf(e.wakeAt))}`;
}

function sessionSub(e: SleepEntry): string {
  const parts: string[] = [];
  const d = sleepDuration(e);
  if (d !== null) parts.push(formatDuration(d));
  const l = latency(e);
  if (l !== null) parts.push(t('sleep.fellAsleepIn', { time: formatDuration(l) }));
  if (!isNight(e)) parts.push(t('sleep.nap'));
  else {
    const late = lateness(clockOf(e.bedAt), e.plannedBed);
    if (Math.abs(late) >= 5) parts.push(t('sleep.vsPlan', { delta: signed(late) }));
  }
  return parts.join(' · ');
}

/** In bed → "woke up"; otherwise "going to sleep" (any time of day) plus the last session. */
export function SleepCard() {
  const open = openSession.value;
  const s = settings.value.value;
  if (open) {
    return (
      <Card>
        <p class="sleep-card__title">{t('sleep.sleeping')}</p>
        <p class="sleep-card__text num">{t('sleep.wentToBed', { time: formatTime(clockOf(open.bedAt)) })}</p>
        <Button variant="primary" block icon="sunrise" onClick={() => openSessionForm(open)}>
          {t('sleep.wakeUp')}
        </Button>
      </Card>
    );
  }
  const last = sortedSleep.value[0];
  const recent = last?.wakeAt != null && Date.now() - last.wakeAt < 6 * 3_600_000 ? last : undefined;
  return (
    <Card>
      {recent ? (
        <button type="button" class="sleep-card__last" onClick={() => openSessionForm(recent)}>
          <span class="sleep-card__title num">{t('sleep.slept', { time: formatDuration(sleepDuration(recent) ?? 0) })}</span>
          <span class="sleep-card__text">{sessionSub(recent)}</span>
        </button>
      ) : (
        <p class="sleep-card__text num">{t('sleep.planLine', { bed: formatTime(s.dayEnd), wake: formatTime(s.dayStart), duration: formatDuration(plannedDuration(s.dayEnd, s.dayStart)) })}</p>
      )}
      <Button
        variant="primary"
        block
        icon="moon"
        feedback="success"
        onClick={() => {
          goToBed();
          haptic('success');
        }}
      >
        {t('sleep.goToBed')}
      </Button>
    </Card>
  );
}

export function SleepView() {
  const week = sleepStats(recentSessions(7));
  const history = recentSessions(30);
  const s = settings.value.value;
  const planned = plannedDuration(s.dayEnd, s.dayStart);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13));

  return (
    <>
      <Section>
        <SleepCard />
      </Section>

      {history.length === 0 ? (
        <EmptyState icon="moon" title={t('sleep.empty')} text={t('sleep.emptyText')} />
      ) : (
        <>
          <Section title={t('sleep.week')}>
            <div class="stat-grid">
              <Card>
                <Stat label={t('sleep.avgSleep')} value={week.duration === null ? '—' : formatDuration(week.duration)} />
              </Card>
              <Card>
                <Stat label={t('sleep.avgLatency')} value={week.latency === null ? '—' : formatDuration(Math.round(week.latency))} />
              </Card>
              <Card>
                <Stat label={t('sleep.bedDelay')} value={week.bedDelay === null ? '—' : signed(Math.round(week.bedDelay))} />
              </Card>
              <Card>
                <Stat label={t('sleep.asleepAvg')} value={week.asleepAt === null ? '—' : formatTime(week.asleepAt)} {...(week.spread === null ? {} : { unit: `±${Math.round(week.spread)} ${t('units.min')}` })} />
              </Card>
            </div>
            {week.debt !== null && <p class="settings__note">{week.debt > 0 ? t('sleep.debt', { time: formatDuration(week.debt) }) : t('sleep.noDebt')}</p>}
            {week.naps > 0 && <p class="settings__note">{t('sleep.naps', { count: week.naps, time: formatDuration(week.napTime) })}</p>}
          </Section>

          <Section title={t('sleep.chart', { planned: formatDuration(planned) })}>
            <Card>
              <BarChart bars={last14.map((d) => ({ key: d, label: String(Number(d.slice(8))), value: totalOn(d) / 60 }))} format={(v) => formatDuration(v * 60)} />
            </Card>
          </Section>

          <Section title={t('sleep.history')}>
            <List>
              {history.map((e) => (
                <ListRow key={e.id} title={<span class="num">{sessionLine(e)}</span>} subtitle={sessionSub(e)} value={formatDayMonth(dayOf(e))} onClick={() => openSessionForm(e)} />
              ))}
            </List>
          </Section>
        </>
      )}

      <Section>
        <List>
          <ListRow icon="clock" title={t('sleep.plan')} subtitle={t('sleep.planSub', { bed: formatTime(s.dayEnd), wake: formatTime(s.dayStart) })} chevron onClick={() => void openSheet((close) => <DayWindowForm close={close} />, { title: t('sleep.plan') })} />
          <ListRow icon="plus" title={t('sleep.addSleep')} subtitle={t('sleep.addSleepSub')} chevron onClick={() => openSessionForm(null)} />
        </List>
      </Section>
    </>
  );
}

// ── Today & quick menu ─────────────────────────────────────────────────────

/**
 * Relevant while asleep (to stamp waking up), in the morning before anything
 * was logged for today, and around the planned bedtime.
 */
export function sleepRelevance(): number {
  if (openSession.value) return 0.9;
  const now = nowMinutes();
  const s = settings.value.value;
  const loggedToday = sortedSleep.value.some((e) => e.wakeAt !== null && dayOf(e) === today());
  if (!loggedToday && now >= s.dayStart - 60 && now < 12 * 60) return 0.9;
  const toBed = lateness(now, s.dayEnd);
  return toBed >= -90 && toBed <= 180 ? 0.9 : 0;
}

export function SleepWidget({ date }: { date: ISODate }) {
  if (date !== today() || sleepRelevance() === 0) return null;
  const morning = !openSession.value && nowMinutes() < 12 * 60;
  return (
    <Section title={t('sleep.title')}>
      {morning ? (
        <Card>
          <p class="sleep-card__title">{t('sleep.goodMorning')}</p>
          <Button variant="primary" block icon="sunrise" onClick={() => openSessionForm(null)}>
            {t('sleep.logMorning')}
          </Button>
        </Card>
      ) : (
        <SleepCard />
      )}
    </Section>
  );
}

export function QuickSleep({ close }: QuickActionContext) {
  const open = openSession.value;
  if (open) return <SessionForm entry={open} close={close} />;
  return (
    <div class="quick-stack">
      <SleepCard />
    </div>
  );
}

export function sleepHint(): string | null {
  const open = openSession.value;
  if (open) return t('sleep.since', { time: formatTime(clockOf(open.bedAt)) });
  const last = sortedSleep.value.find((e) => e.wakeAt !== null);
  return last ? formatDuration(sleepDuration(last) ?? 0) : null;
}
