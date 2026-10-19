import { addDays, diffDays, startOfWeek, today, toJSDate, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { cx, Icon } from './primitives';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
// Standalone month name: «октябрь», not «октября».
const MONTH = new Intl.DateTimeFormat('ru-RU', { month: 'long' });

/** Week of days with prev/next; `marks` puts a dot under a day. */
export function DateStrip({
  value,
  onChange,
  marks,
}: {
  value: ISODate;
  onChange: (d: ISODate) => void;
  marks?: (d: ISODate) => boolean;
}) {
  const monday = startOfWeek(value);
  const now = today();
  const select = (d: ISODate): void => {
    if (d === value) return;
    haptic('selection');
    onChange(d);
  };
  const monthLabel = MONTH.format(toJSDate(value));
  return (
    <div class="ui-strip">
      <div class="ui-strip__head">
        <button type="button" class="ui-strip__nav" aria-label="Предыдущая неделя" onClick={() => select(addDays(value, -7))}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <span class="ui-strip__month">
          {monthLabel} {toJSDate(monday).getFullYear()}
        </span>
        {diffDays(now, value) !== 0 && (
          <button type="button" class="ui-strip__today" onClick={() => select(now)}>
            Сегодня
          </button>
        )}
        <button type="button" class="ui-strip__nav" aria-label="Следующая неделя" onClick={() => select(addDays(value, 7))}>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
      <div class="ui-strip__days">
        {WEEKDAYS.map((name, i) => {
          const d = addDays(monday, i);
          return (
            <button
              key={d}
              type="button"
              class={cx('ui-strip__day', d === value && 'is-selected', d === now && 'is-today')}
              onClick={() => select(d)}
            >
              <span class="ui-strip__wd">{name}</span>
              <span class="ui-strip__num num">{toJSDate(d).getDate()}</span>
              <span class={cx('ui-strip__dot', marks?.(d) && 'is-on')} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
