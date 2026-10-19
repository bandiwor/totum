import { formatDuration, formatTime, nowMinutes, today } from '@/core/date';
import { registry, type AgendaItem } from '@/core/registry';
import type { TimelineSegment } from '@/core/timeline';
import { places } from '@/features/places/model';
import { dayTimeline } from '@/features/today/useDayTimeline';
import { EmptyState, Icon, type IconName } from '@/ui';

interface BriefLine {
  key: string;
  time: string;
  title: string;
  note?: string;
  icon: IconName;
  tone: 'busy' | 'travel' | 'free' | 'todo' | 'late';
}

const placeName = (id: string | null): string => (id ? (places.get(id)?.name ?? 'место') : '');

function fromSegment(seg: TimelineSegment, now: number): BriefLine | null {
  if (seg.end <= now) return null;
  const key = `${seg.kind}-${seg.start}`;
  switch (seg.kind) {
    case 'busy':
      return {
        key,
        time: `${formatTime(seg.start)}–${formatTime(seg.end)}`,
        title: seg.block.title,
        icon: 'calendar',
        tone: 'busy',
        ...(seg.block.subtitle ? { note: seg.block.subtitle } : {}),
      };
    case 'travel':
      return {
        key,
        time: formatTime(seg.start),
        title: `Выйти → ${placeName(seg.to)}`,
        note: seg.late > 0 ? `не успеваешь на ${formatDuration(seg.late)}` : `в пути ${formatDuration(seg.end - seg.start)}`,
        icon: 'navigation',
        tone: seg.late > 0 ? 'late' : 'travel',
      };
    case 'free': {
      const len = seg.end - Math.max(seg.start, now);
      if (len < 15) return null;
      return {
        key,
        time: formatTime(Math.max(seg.start, now)),
        title: `Свободно ${formatDuration(len)}`,
        note: seg.atHome ? 'дома' : placeName(seg.placeId),
        icon: 'sparkles',
        tone: 'free',
      };
    }
  }
}

const fromAgenda = (a: AgendaItem): BriefLine => ({
  key: `${a.source}-${a.id}`,
  time: a.time === null ? '' : formatTime(a.time),
  title: a.title,
  icon: 'tasks',
  tone: 'todo',
});

/** "What's next" — a compact, time-aware list for the quick menu. */
export function BriefScreen() {
  const date = today();
  const now = nowMinutes();
  const timeline = dayTimeline(date);
  const agenda = registry.agenda(date).filter((a) => !a.done);

  const timed = [
    ...timeline.segments.map((s) => fromSegment(s, now)).filter((l): l is BriefLine => l !== null),
    ...agenda.filter((a) => a.time !== null && a.time >= now - 30).map(fromAgenda),
  ]
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 7);
  const untimed = agenda.filter((a) => a.time === null).map(fromAgenda);

  if (timed.length === 0 && untimed.length === 0) {
    return <EmptyState icon="sparkles" title="На сегодня всё" text="Ничего запланированного до конца дня." />;
  }

  return (
    <div class="brief">
      {timed.map((l) => (
        <div key={l.key} class={`brief__line is-${l.tone}`}>
          <span class="brief__time num">{l.time}</span>
          <span class="brief__icon">
            <Icon name={l.icon} size={16} />
          </span>
          <span class="brief__text">
            <span class="brief__title">{l.title}</span>
            {l.note && <span class="brief__note">{l.note}</span>}
          </span>
        </div>
      ))}
      {untimed.length > 0 && (
        <>
          <p class="brief__group">Без времени</p>
          {untimed.map((l) => (
            <div key={l.key} class="brief__line is-todo">
              <span class="brief__time" />
              <span class="brief__icon">
                <Icon name={l.icon} size={16} />
              </span>
              <span class="brief__text">
                <span class="brief__title">{l.title}</span>
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
