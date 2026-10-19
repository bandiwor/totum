import { useState } from 'preact/hooks';
import { addDays, addMonths, formatMonth, startOfWeek, today, toJSDate, weekdayShort, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { openSheet } from './overlays';
import { Button, cx, Icon } from './primitives';

const firstOfMonth = (d: ISODate): ISODate => `${d.slice(0, 8)}01` as ISODate;

/** Month grid (Mon-first, 6 weeks), swipe-free: arrows switch months. */
export function Calendar({ value, onPick }: { value: ISODate | null; onPick: (d: ISODate) => void }) {
  const now = today();
  const [month, setMonth] = useState<ISODate>(firstOfMonth(value ?? now));
  const [dir, setDir] = useState<'next' | 'prev' | null>(null);
  const start = startOfWeek(month);
  const shift = (n: number): void => {
    haptic('selection');
    setDir(n > 0 ? 'next' : 'prev');
    setMonth(addMonths(month, n));
  };

  return (
    <div class="ui-cal">
      <div class="ui-cal__head">
        <button type="button" class="ui-strip__nav" aria-label={t('time.prevMonth')} onClick={() => shift(-1)}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <span class="ui-cal__title">
          {formatMonth(month)} {toJSDate(month).getFullYear()}
        </span>
        <button type="button" class="ui-strip__nav" aria-label={t('time.nextMonth')} onClick={() => shift(1)}>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
      <div class="ui-cal__grid">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={`w${i}`} class="ui-cal__wd">
            {weekdayShort(i)}
          </span>
        ))}
      </div>
      <div key={month} class={cx('ui-cal__grid ui-cal__days', dir && `is-${dir}`)}>
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(start, i);
          const outside = d.slice(0, 7) !== month.slice(0, 7);
          return (
            <button
              key={d}
              type="button"
              class={cx('ui-cal__day num', outside && 'is-outside', d === now && 'is-today', d === value && 'is-selected')}
              onClick={() => {
                haptic('selection');
                onPick(d);
              }}
            >
              {toJSDate(d).getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Opens a calendar sheet; `clearable` adds a "no date" button. */
export function openDatePicker(value: ISODate | null, onPick: (d: ISODate | null) => void, opts: { title?: string; clearable?: boolean } = {}): void {
  void openSheet(
    (close) => (
      <>
        <Calendar
          value={value}
          onPick={(d) => {
            onPick(d);
            close();
          }}
        />
        <div class="ui-cal__actions">
          <Button
            variant="secondary"
            block
            onClick={() => {
              onPick(today());
              close();
            }}
          >
            {t('common.today')}
          </Button>
          {opts.clearable && value !== null && (
            <Button
              variant="ghost"
              block
              onClick={() => {
                onPick(null);
                close();
              }}
            >
              {t('time.noDate')}
            </Button>
          )}
        </div>
      </>
    ),
    { title: opts.title ?? t('time.pickDate') },
  );
}
