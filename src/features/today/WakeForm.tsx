import { useState } from 'preact/hooks';
import { formatRelativeDay, formatTime, type ISODate, type Minutes } from '@/core/date';
import { hasCustomWake, setWake, wakeFor } from '@/core/dayWindow';
import { haptic } from '@/core/haptics';
import { t } from '@/core/i18n';
import { settings } from '@/core/settings';
import { Button, Form, openSheet, SheetActions, TimeField } from '@/ui';
import { homeId } from '@/features/places/model';
import { firstTrip } from './leave';
import { dayTimeline } from './useDayTimeline';

/** Hint: "to make it to X at 7:40 you need to leave at 7:05". */
export function wakeHint(date: ISODate): string | null {
  const trip = firstTrip(dayTimeline(date).segments, homeId.value, settings.value.value.arriveEarly);
  if (!trip) return null;
  return trip.late > 0
    ? t('today.wakeTooLate', { what: trip.title, time: formatTime(trip.startsAt), leave: formatTime(trip.leaveAt) })
    : t('today.firstLeave', { leave: formatTime(trip.leaveAt), what: trip.title });
}

function WakeForm({ date, close }: { date: ISODate; close: () => void }) {
  const [time, setTime] = useState<Minutes>(wakeFor(date));
  const usual = settings.value.value.dayStart;
  const hint = wakeHint(date);
  return (
    <Form>
      <TimeField value={time} onChange={setTime} />
      {hint && <p class="sheet-note">{hint}</p>}
      <SheetActions>
        <Button
          variant="primary"
          size="lg"
          block
          feedback="success"
          onClick={() => {
            setWake(date, time);
            close();
          }}
        >
          {t('common.save')}
        </Button>
        {hasCustomWake(date) && (
          <Button
            variant="ghost"
            block
            onClick={() => {
              haptic('light');
              setWake(date, null);
              close();
            }}
          >
            {t('today.wakeUsual', { time: formatTime(usual) })}
          </Button>
        )}
      </SheetActions>
    </Form>
  );
}

export function openWakeForm(date: ISODate): void {
  void openSheet((close) => <WakeForm date={date} close={close} />, { title: t('today.wakeTitle', { day: formatRelativeDay(date).toLowerCase() }) });
}
