import { addDays, diffDays, formatMonth, startOfWeek, today, toJSDate, weekdayShort, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { cx, Icon } from './primitives';
import { t } from '@/core/i18n';


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
  const monthLabel = formatMonth(value);
  return (
    <div class="ui-strip">
      <div class="ui-strip__head">
        <button type="button" class="ui-strip__nav" aria-label={t('time.prevWeek')} onClick={() => select(addDays(value, -7))}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <span class="ui-strip__month">
          {monthLabel} {toJSDate(monday).getFullYear()}
        </span>
        {diffDays(now, value) !== 0 && (
          <button type="button" class="ui-strip__today" onClick={() => select(now)}>
            {t('common.today')}
          </button>
        )}
        <button type="button" class="ui-strip__nav" aria-label={t('time.nextWeek')} onClick={() => select(addDays(value, 7))}>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
      <div class="ui-strip__days">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(monday, i);
          return (
            <button
              key={d}
              type="button"
              class={cx('ui-strip__day', d === value && 'is-selected', d === now && 'is-today')}
              onClick={() => select(d)}
            >
              <span class="ui-strip__wd">{weekdayShort(i)}</span>
              <span class="ui-strip__num num">{toJSDate(d).getDate()}</span>
              <span class={cx('ui-strip__dot', marks?.(d) && 'is-on')} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
