import { formatDuration, formatRelativeDay, formatWeekday, formatDayMonth, today, type ISODate } from '@/core/date';
import { registry } from '@/core/registry';
import { navigate } from '@/core/router';
import { settings } from '@/core/settings';
import { Button, Card, DateStrip, IconButton, List, ListRow, openSheet, Page, ProgressRing, Section, Stat } from '@/ui';
import { timetables } from '@/features/schedule/model';
import { jobs } from '@/features/work/model';
import { selectDate, selectedDate } from './selectedDate';
import { TimelineWidget } from './TimelineWidget';
import { useDayTimeline } from './useDayTimeline';

function openDayActions(date: ISODate): void {
  openSheet(
    (close) => (
      <List>
        {registry.dayActions().map((a) => (
          <ListRow
            key={a.id}
            icon={a.icon}
            iconColor="var(--accent)"
            title={a.label}
            chevron
            onClick={() => {
              close();
              // Let the closing sheet animate before the next one opens.
              setTimeout(() => a.run(date), 120);
            }}
          />
        ))}
      </List>
    ),
    { title: `Добавить · ${formatRelativeDay(date).toLowerCase()}` },
  );
}

function FreeTimeCard({ date }: { date: ISODate }) {
  const { free } = useDayTimeline(date).value;
  const s = settings.value.value;
  const awake = Math.max(1, s.dayEnd - s.dayStart);
  return (
    <Card>
      <div class="today__free">
        <ProgressRing value={free.total} max={awake} size={64}>
          <span class="num">{Math.round((free.total / awake) * 100)}%</span>
        </ProgressRing>
        <div class="today__free-stats">
          <Stat label="Свободно" value={formatDuration(free.total)} />
          <div class="today__free-row">
            <Stat label="Дома" value={formatDuration(free.atHome)} />
            <Stat label="Вне дома" value={formatDuration(free.away)} />
            <Stat label="Дорога" value={formatDuration(free.travel)} />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function TodayScreen() {
  const date = selectedDate.value;
  const widgets = registry.todayWidgets();
  const nothingSetUp = timetables.all.value.length === 0 && jobs.all.value.length === 0;
  const hasOpenItems = (d: ISODate): boolean => registry.agenda(d).some((a) => !a.done) || registry.busyBlocks(d).length > 0;

  return (
    <Page
      title={formatRelativeDay(date)}
      large
      actions={<IconButton icon="settings" label="Настройки" onClick={() => navigate('settings')} />}
      toolbar={<DateStrip value={date} onChange={selectDate} marks={hasOpenItems} />}
    >
      {date === today() || <p class="today__date">{formatWeekday(date, 'long')}, {formatDayMonth(date)}</p>}

      <Section>
        <FreeTimeCard date={date} />
      </Section>

      <Section title="День" action={<Button size="sm" variant="ghost" icon="plus" onClick={() => openDayActions(date)}>Добавить</Button>}>
        <TimelineWidget date={date} />
        {nothingSetUp && (
          <Card onClick={() => navigate('plan/setup')}>
            <p class="today__setup-title">Настрой расписание</p>
            <p class="today__setup-text">Пары, работа, места и дорога — и здесь появится твой день со свободными окнами.</p>
          </Card>
        )}
      </Section>

      {widgets.map((w) => (
        <w.component key={w.id} date={date} />
      ))}
    </Page>
  );
}
