import { formatDuration, formatTime, minuteTick, nowMinutes, today } from '@/core/date';
import { t } from '@/core/i18n';
import { places } from '@/features/places/model';
import { cx, Icon } from '@/ui';
import { nextDeparture } from './leave';
import { dayTimeline } from './useDayTimeline';

/** "Time to go" — on Today and in the brief. Counts travel time and the arrive-early buffer. */
export function LeaveCard() {
  void minuteTick.value;
  const now = nowMinutes();
  const dep = nextDeparture(dayTimeline(today()).segments, now);
  if (!dep) return null;
  const place = places.get(dep.to)?.name ?? '';
  const due = dep.inMin <= 0;
  return (
    <div class={cx('leave-card', due && 'is-due', dep.lateIfNow > 0 && 'is-late')} role="status">
      <span class="leave-card__icon">
        <Icon name="navigation" size={20} />
      </span>
      <span class="leave-card__text">
        <span class="leave-card__title num">{due ? t('today.leaveNow') : t('today.leaveIn', { duration: formatDuration(dep.inMin) })}</span>
        <span class="leave-card__sub num">
          {t('today.leaveTo', { place, trip: formatDuration(dep.trip), what: dep.title, time: formatTime(dep.startsAt) })}
        </span>
        {dep.lateIfNow > 0 && <span class="leave-card__late num">{t('today.lateIfNow', { duration: formatDuration(dep.lateIfNow) })}</span>}
      </span>
    </div>
  );
}
