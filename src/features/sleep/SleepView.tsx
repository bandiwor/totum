import { useState } from 'preact/hooks';
import { addDays, formatDayMonth, formatDuration, formatTime, nowMinutes, today, type ISODate, type Minutes } from '@/core/date';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import type { QuickActionContext } from '@/core/registry';
import { settings } from '@/core/settings';
import { DayWindowForm } from '@/features/plan/SetupList';
import { BarChart, Button, Card, DateField, EmptyState, Form, List, ListRow, openSheet, Section, SheetActions, Stat, TimeField } from '@/ui';
import {
  entryFor,
  goToBed,
  latency,
  lateness,
  nightDate,
  plannedDuration,
  recentNights,
  saveNight,
  sleepDuration,
  sleepLog,
  sleepStats,
  span,
  typicalLatency,
  type SleepEntry,
} from './model';

const round5 = (m: Minutes): Minutes => (Math.round(m / 5) * 5) % 1440;
const signed = (m: number): string => `${m > 0 ? '+' : m < 0 ? '−' : ''}${formatDuration(Math.abs(m))}`;

/** Morning check-in or editing a past night: when I lay down, roughly fell asleep, woke up. */
export function NightForm({ date: initialDate, close }: { date: ISODate; close: () => void }) {
  const [date, setDate] = useState(initialDate);
  const entry = entryFor(date);
  const s = settings.value.value;
  const bedDefault = entry?.bedAt ?? entry?.plannedBed ?? s.dayEnd;
  const [bedAt, setBed] = useState<Minutes>(bedDefault);
  const [asleepAt, setAsleep] = useState<Minutes>(entry?.asleepAt ?? round5(bedDefault + typicalLatency.value));
  const [wakeAt, setWake] = useState<Minutes>(entry?.wakeAt ?? (date === today() ? round5(nowMinutes()) : (entry?.plannedWake ?? s.dayStart)));

  const asleepFor = span(asleepAt, wakeAt);
  const fallAsleep = span(bedAt, asleepAt);

  return (
    <Form>
      {!entry && <DateField label={t('sleep.morningOf')} value={date} onChange={(d) => d && setDate(d)} />}
      <TimeField label={t('sleep.bedAt')} value={bedAt} onChange={setBed} />
      <TimeField label={t('sleep.asleepAt')} value={asleepAt} onChange={setAsleep} />
      <TimeField label={t('sleep.wakeAt')} value={wakeAt} onChange={setWake} />
      <p class="sheet-note num">{t('sleep.summary', { sleep: formatDuration(asleepFor), latency: formatDuration(fallAsleep) })}</p>
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          feedback="success"
          onClick={() => {
            saveNight(date, { bedAt, asleepAt, wakeAt });
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

export const openNight = (date: ISODate): void =>
  void openSheet((close) => <NightForm date={date} close={close} />, { title: t('sleep.night', { date: formatDayMonth(date) }) });

/** Morning = from 3 h before the planned wake-up until noon; the rest of the day leads to bedtime. */
function isMorning(now: Minutes): boolean {
  return now < 12 * 60 && now >= Math.max(0, settings.value.value.dayStart - 180);
}

/** Evening: the "going to sleep" stamp. Morning: the check-in, or last night's summary. */
export function NightCard() {
  const now = nowMinutes();
  const s = settings.value.value;
  const tonight = entryFor(nightDate(now));

  if (isMorning(now)) {
    const slept = tonight && tonight.wakeAt !== null ? sleepDuration(tonight) : null;
    if (tonight && slept !== null) {
      return (
        <Card onClick={() => openNight(tonight.date)}>
          <p class="sleep-card__title num">{t('sleep.slept', { time: formatDuration(slept) })}</p>
          <p class="sleep-card__text">{nightSub(tonight)}</p>
        </Card>
      );
    }
    return (
      <Card>
        <p class="sleep-card__title">{t('sleep.goodMorning')}</p>
        {tonight?.bedAt != null && <p class="sleep-card__text num">{t('sleep.wentToBed', { time: formatTime(tonight.bedAt) })}</p>}
        <Button variant="primary" block icon="sunrise" onClick={() => openNight(today())}>
          {t('sleep.logMorning')}
        </Button>
      </Card>
    );
  }

  if (tonight && tonight.bedAt !== null && tonight.wakeAt === null) {
    return (
      <Card>
        <p class="sleep-card__title">{t('sleep.goodNight')}</p>
        <p class="sleep-card__text num">{t('sleep.wentToBed', { time: formatTime(tonight.bedAt) })}</p>
      </Card>
    );
  }
  return (
    <Card>
      <p class="sleep-card__text num">{t('sleep.planLine', { bed: formatTime(s.dayEnd), wake: formatTime(s.dayStart), duration: formatDuration(plannedDuration(s.dayEnd, s.dayStart)) })}</p>
      <Button
        variant="primary"
        block
        icon="moon"
        feedback="success"
        onClick={() => {
          goToBed(nowMinutes());
          haptic('success');
        }}
      >
        {t('sleep.goToBed')}
      </Button>
    </Card>
  );
}

function nightLine(e: SleepEntry): string {
  const start = e.bedAt ?? e.asleepAt;
  return start === null ? '—' : `${formatTime(start)} → ${e.wakeAt === null ? '…' : formatTime(e.wakeAt)}`;
}

function nightSub(e: SleepEntry): string {
  const parts: string[] = [];
  const d = sleepDuration(e);
  if (d !== null) parts.push(formatDuration(d));
  const l = latency(e);
  if (l !== null) parts.push(t('sleep.fellAsleepIn', { time: formatDuration(l) }));
  if (e.bedAt !== null) {
    const late = lateness(e.bedAt, e.plannedBed);
    if (Math.abs(late) >= 5) parts.push(t('sleep.vsPlan', { delta: signed(late) }));
  }
  return parts.join(' · ');
}

export function SleepView() {
  const week = sleepStats(recentNights(7));
  const month = sleepStats(recentNights(30));
  const s = settings.value.value;
  const planned = plannedDuration(s.dayEnd, s.dayStart);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13));
  const history = recentNights(30);

  return (
    <>
      <Section>
        <NightCard />
      </Section>

      {month.nights === 0 ? (
        <EmptyState icon="moon" title={t('sleep.empty')} text={t('sleep.emptyText')} />
      ) : (
        <>
          <Section title={t('sleep.week')}>
            <div class="stat-grid">
              <Card>
                <Stat label={t('sleep.avgSleep')} value={week.duration === null ? '—' : formatDuration(week.duration)} />
              </Card>
              <Card>
                <Stat label={t('sleep.avgLatency')} value={week.latency === null ? '—' : formatDuration(week.latency)} />
              </Card>
              <Card>
                <Stat label={t('sleep.bedDelay')} value={week.bedDelay === null ? '—' : signed(Math.round(week.bedDelay))} />
              </Card>
              <Card>
                <Stat label={t('sleep.asleepAvg')} value={week.asleepAt === null ? '—' : formatTime(week.asleepAt)} {...(week.spread === null ? {} : { unit: `±${Math.round(week.spread)} ${t('units.min')}` })} />
              </Card>
            </div>
            {week.debt !== null && (
              <p class="settings__note">{week.debt > 0 ? t('sleep.debt', { time: formatDuration(week.debt) }) : t('sleep.noDebt')}</p>
            )}
          </Section>

          <Section title={t('sleep.chart', { planned: formatDuration(planned) })}>
            <Card>
              <BarChart
                bars={last14.map((d) => {
                  const e = entryFor(d);
                  return { key: d, label: String(Number(d.slice(8))), value: e ? (sleepDuration(e) ?? 0) / 60 : 0 };
                })}
                format={(v) => formatDuration(v * 60)}
              />
            </Card>
          </Section>

          <Section title={t('sleep.history')}>
            <List>
              {history.map((e) => (
                <ListRow key={e.id} title={<span class="num">{nightLine(e)}</span>} subtitle={nightSub(e)} value={formatDayMonth(e.date)} onClick={() => openNight(e.date)} />
              ))}
            </List>
          </Section>
        </>
      )}

      <Section>
        <List>
          <ListRow icon="clock" title={t('sleep.plan')} subtitle={t('sleep.planSub', { bed: formatTime(s.dayEnd), wake: formatTime(s.dayStart) })} chevron onClick={() => void openSheet((close) => <DayWindowForm close={close} />, { title: t('sleep.plan') })} />
          <ListRow icon="plus" title={t('sleep.addNight')} chevron onClick={() => openNight(today())} />
        </List>
      </Section>
    </>
  );
}

// ── Today & quick menu ─────────────────────────────────────────────────────

/** Shown on Today only when there's something to do: before bedtime or an unfinished night in the morning. */
export function SleepWidget({ date }: { date: ISODate }) {
  if (date !== today() || !sleepRelevant()) return null;
  return (
    <Section title={t('sleep.title')}>
      <NightCard />
    </Section>
  );
}

export function sleepRelevant(): number {
  const now = nowMinutes();
  const tonight = entryFor(nightDate(now));
  if (isMorning(now)) return !tonight || tonight.wakeAt === null ? 0.9 : 0;
  const toBed = lateness(now, settings.value.value.dayEnd);
  return toBed >= -90 && toBed <= 180 && tonight?.bedAt == null ? 0.9 : 0;
}

export function QuickSleep({ close }: QuickActionContext) {
  if (isMorning(nowMinutes()) && sleepRelevant() > 0) return <NightForm date={today()} close={close} />;
  return (
    <div class="quick-stack">
      <NightCard />
    </div>
  );
}

export function sleepHint(): string | null {
  const last = recentNights(2).find((e) => sleepDuration(e) !== null);
  return last ? formatDuration(sleepDuration(last)!) : null;
}
