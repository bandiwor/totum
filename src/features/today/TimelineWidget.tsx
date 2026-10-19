import { formatDuration, formatTime, nowMinutes, today, type ISODate } from '@/core/date';
import { haptic } from '@/core/haptics';
import { registry } from '@/core/registry';
import type { BusyBlock, TimelineSegment } from '@/core/timeline';
import { places } from '@/features/places/model';
import { cx, Icon } from '@/ui';
import { useDayTimeline } from './useDayTimeline';
import { t } from '@/core/i18n';

type Row =
  | { kind: 'segment'; at: number; seg: TimelineSegment }
  | { kind: 'cancelled'; at: number; block: BusyBlock }
  | { kind: 'now'; at: number };

const placeName = (id: string | null): string => (id ? (places.get(id)?.name ?? '') : '');

function BlockCard({ date, block, state }: { date: ISODate; block: BusyBlock; state: 'normal' | 'cancelled' | 'past' | 'current' }) {
  return (
    <button
      type="button"
      class={cx('tl-block', `is-${state}`)}
      style={{ '--block-color': block.color ?? 'var(--c-8)' }}
      onClick={() => {
        haptic('selection');
        registry.openBlock(date, block);
      }}
    >
      <span class="tl-block__time num">
        <span>{formatTime(block.start)}</span>
        <span>{formatTime(block.end)}</span>
      </span>
      <span class="tl-block__card">
        <span class="tl-block__title">{block.title}</span>
        {block.subtitle && <span class="tl-block__sub">{block.subtitle}</span>}
        {state === 'cancelled' && <span class="tl-block__sub">{t('today.cancelledHint')}</span>}
        {block.badge && state !== 'cancelled' && <span class="tl-block__badge">{block.badge}</span>}
      </span>
    </button>
  );
}

export function TimelineWidget({ date }: { date: ISODate }) {
  const { segments } = useDayTimeline(date).value;
  const cancelled = registry.cancelledBlocks(date);
  const isToday = date === today();
  const now = nowMinutes();

  const rows: Row[] = [
    ...segments.map((seg): Row => ({ kind: 'segment', at: seg.start, seg })),
    ...cancelled.map((block): Row => ({ kind: 'cancelled', at: block.start, block })),
  ];
  if (isToday) rows.push({ kind: 'now', at: now });
  rows.sort((a, b) => a.at - b.at || (a.kind === 'now' ? -1 : b.kind === 'now' ? 1 : 0));

  return (
    <div class="tl">
      {rows.map((row) => {
        if (row.kind === 'now') {
          return (
            <div key="now" class="tl-now">
              <span class="num">{formatTime(now)}</span>
            </div>
          );
        }
        if (row.kind === 'cancelled') return <BlockCard key={`c-${row.block.source}-${row.block.id}`} date={date} block={row.block} state="cancelled" />;
        const seg = row.seg;
        const past = isToday && seg.end <= now;
        switch (seg.kind) {
          case 'busy':
            return (
              <BlockCard
                key={`b-${seg.block.source}-${seg.block.id}`}
                date={date}
                block={seg.block}
                state={past ? 'past' : isToday && seg.start <= now ? 'current' : 'normal'}
              />
            );
          case 'travel':
            return (
              <div key={`t-${seg.start}`} class={cx('tl-travel', seg.late > 0 && 'is-late', past && 'is-past')}>
                <Icon name="navigation" size={14} />
                <span class="num">{formatTime(seg.start)}</span>
                <span>
                  {t('today.travelTo', { place: placeName(seg.to), duration: formatDuration(seg.end - seg.start) })}
                  {seg.late > 0 && t('today.late', { duration: formatDuration(seg.late) })}
                </span>
              </div>
            );
          case 'free': {
            const len = seg.end - seg.start;
            if (len < 10) return null;
            return (
              <div key={`f-${seg.start}`} class={cx('tl-free', past && 'is-past')}>
                <span class="num">{formatTime(seg.start)}</span>
                <span>
                  {t('today.freeFor', { duration: formatDuration(len) })}
                  {seg.atHome ? t('today.atHomeSuffix') : seg.placeId ? t('today.placeSuffix', { place: placeName(seg.placeId) }) : ''}
                </span>
              </div>
            );
          }
        }
      })}
    </div>
  );
}
