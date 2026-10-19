import { signal } from '@preact/signals';
import { addDays, formatDayMonth, formatDuration, startOfWeek, today, toJSDate, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { navigate } from '@/core/router';
import { settings } from '@/core/settings';
import { selectDate } from '@/features/today/selectedDate';
import { dayTimeline } from '@/features/today/useDayTimeline';
import { Card, cx, Icon, Stat } from '@/ui';

const weekStart = signal<ISODate>(startOfWeek(today()));
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const GRID_H = 520;

/** Seven columns of the awake window: blocks, travel and free time at a glance. */
export function WeekView() {
  const start = weekStart.value;
  const { dayStart, dayEnd } = settings.value.value;
  const range = Math.max(60, dayEnd - dayStart);
  const y = (m: number): number => ((Math.min(Math.max(m, dayStart), dayEnd) - dayStart) / range) * GRID_H;
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const timelines = days.map((d) => dayTimeline(d));
  const totalFree = timelines.reduce((s, t) => s + t.free.total, 0);
  const totalBusy = timelines.reduce(
    (s, t) => s + t.segments.filter((x) => x.kind === 'busy').reduce((a, x) => a + (x.end - x.start), 0),
    0,
  );
  const now = today();

  const hours: number[] = [];
  for (let h = Math.ceil(dayStart / 60); h * 60 <= dayEnd; h += 2) hours.push(h);

  const shift = (weeks: number): void => {
    haptic('selection');
    weekStart.value = addDays(start, weeks * 7);
  };

  return (
    <>
      <div class="week__nav">
        <button type="button" class="ui-strip__nav" aria-label="Предыдущая неделя" onClick={() => shift(-1)}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <span class="week__range">
          {formatDayMonth(start)} — {formatDayMonth(addDays(start, 6))}
        </span>
        {start !== startOfWeek(now) && (
          <button type="button" class="ui-strip__today" onClick={() => (weekStart.value = startOfWeek(now))}>
            Сейчас
          </button>
        )}
        <button type="button" class="ui-strip__nav" aria-label="Следующая неделя" onClick={() => shift(1)}>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>

      <Card padded={false} class="week">
        <div class="week__head">
          <span />
          {days.map((d, i) => (
            <span key={d} class={cx('week__day', d === now && 'is-today')}>
              <span>{WD[i]}</span>
              <span class="num">{toJSDate(d).getDate()}</span>
            </span>
          ))}
        </div>
        <div class="week__body" style={{ height: GRID_H }}>
          <div class="week__axis">
            {hours.map((h) => (
              <span key={h} class="num" style={{ top: y(h * 60) }}>
                {h}
              </span>
            ))}
          </div>
          {days.map((d, i) => (
            <button
              key={d}
              type="button"
              class="week__col"
              onClick={() => {
                haptic('selection');
                selectDate(d);
                navigate('today');
              }}
            >
              {timelines[i]?.segments.map((seg) => {
                const top = y(seg.start);
                const height = Math.max(2, y(seg.end) - top);
                if (seg.kind === 'free') return <span key={`f${seg.start}`} class="week__free" style={{ top, height }} />;
                if (seg.kind === 'travel') return <span key={`t${seg.start}`} class={cx('week__travel', seg.late > 0 && 'is-late')} style={{ top, height }} />;
                return (
                  <span key={`b${seg.block.source}${seg.block.id}`} class="week__busy" style={{ top, height, '--block-color': seg.block.color ?? 'var(--c-8)' }}>
                    {height > 22 && <span>{seg.block.title}</span>}
                  </span>
                );
              })}
            </button>
          ))}
        </div>
        <div class="week__foot">
          <span />
          {timelines.map((t, i) => (
            <span key={i} class="num">
              {Math.round(t.free.total / 60)}ч
            </span>
          ))}
        </div>
      </Card>

      <div class="week__stats">
        <Card>
          <Stat label="Свободно за неделю" value={formatDuration(totalFree)} />
        </Card>
        <Card>
          <Stat label="Занято" value={formatDuration(totalBusy)} />
        </Card>
      </div>
      <p class="settings__note">Зелёное — свободно, штриховка — дорога. Нажми на день, чтобы открыть его.</p>
    </>
  );
}
