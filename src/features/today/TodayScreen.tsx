import { formatDuration, formatRelativeDay, formatWeekday, formatDayMonth, today } from '@/core/date';
import { registry } from '@/core/registry';
import { navigate } from '@/core/router';
import { Card, EmptyState, IconButton, Page, ProgressRing, Section, Stat } from '@/ui';
import { settings } from '@/core/settings';
import { useDayTimeline } from './useDayTimeline';

export function TodayScreen() {
  const date = today();
  const timeline = useDayTimeline(date).value;
  const widgets = registry.todayWidgets();
  const s = settings.value.value;
  const awake = s.dayEnd - s.dayStart;
  const hasBlocks = timeline.segments.some((seg) => seg.kind === 'busy');

  return (
    <Page
      title={formatRelativeDay(date)}
      large
      actions={<IconButton icon="settings" label="Настройки" onClick={() => navigate('settings')} />}
    >
      <p class="today__date">
        {formatWeekday(date, 'long')}, {formatDayMonth(date)}
      </p>

      <Section title="Свободное время">
        <Card>
          <div class="today__free">
            <ProgressRing value={timeline.free.total} max={awake} size={72}>
              <span class="num">{Math.round((timeline.free.total / Math.max(1, awake)) * 100)}%</span>
            </ProgressRing>
            <div class="today__free-stats">
              <Stat label="Всего свободно" value={formatDuration(timeline.free.total)} />
              <div class="today__free-row">
                <Stat label="Дома" value={formatDuration(timeline.free.atHome)} />
                <Stat label="Вне дома" value={formatDuration(timeline.free.away)} />
                <Stat label="Дорога" value={formatDuration(timeline.free.travel)} />
              </div>
            </div>
          </div>
          {!hasBlocks && <p class="today__hint">Расписания пока нет — весь день свободен.</p>}
        </Card>
      </Section>

      {widgets.length === 0 ? (
        <Section>
          <EmptyState
            icon="sparkles"
            title="Здесь будет твой день"
            text="Пары, задачи, тренировка, питание и приём добавок появятся по мере подключения разделов."
          />
        </Section>
      ) : (
        widgets.map((w) => <w.component key={w.id} date={date} />)
      )}
    </Page>
  );
}
