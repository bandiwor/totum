import { computed, signal } from '@preact/signals';
import { today, type ISODate } from '@/core/date';

/** `null` = follow the real "today" (so the app shows the new day after midnight). */
const picked = signal<ISODate | null>(null);
const tick = signal(0);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') tick.value++;
});

export const selectedDate = computed<ISODate>(() => {
  void tick.value;
  return picked.value ?? today();
});

export function selectDate(date: ISODate): void {
  picked.value = date === today() ? null : date;
}
