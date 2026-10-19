import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';
import { cx, Icon } from './primitives';

interface Drag {
  from: number;
  to: number;
  dy: number;
  rowH: number;
}

/**
 * A list whose rows are dragged by their grip. Rows are equal-height; the
 * dragged one follows the finger, the others slide aside, `onReorder` gets
 * the keys in the new order on release.
 */
export function ReorderList<T>({
  items,
  keyOf,
  render,
  onReorder,
  gripLabel,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  render: (item: T) => ComponentChildren;
  onReorder: (keys: string[]) => void;
  gripLabel: string;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const start = useRef(0);

  const down = (e: PointerEvent, index: number): void => {
    const row = (e.currentTarget as HTMLElement).closest('.reorder-row') as HTMLElement | null;
    if (!row) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = e.clientY;
    haptic('light');
    setDrag({ from: index, to: index, dy: 0, rowH: row.offsetHeight });
  };

  const move = (e: PointerEvent): void => {
    if (!drag) return;
    const dy = e.clientY - start.current;
    const to = Math.max(0, Math.min(items.length - 1, drag.from + Math.round(dy / drag.rowH)));
    if (to !== drag.to) haptic('selection');
    setDrag({ ...drag, dy, to });
  };

  const up = (): void => {
    if (!drag) return;
    if (drag.to !== drag.from) {
      const keys = items.map(keyOf);
      const [moved] = keys.splice(drag.from, 1);
      keys.splice(drag.to, 0, moved!);
      onReorder(keys);
    }
    setDrag(null);
  };

  const offset = (i: number): number => {
    if (!drag) return 0;
    if (i === drag.from) return drag.dy;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.rowH;
    if (drag.from > drag.to && i < drag.from && i >= drag.to) return drag.rowH;
    return 0;
  };

  return (
    <div class={cx('ui-list reorder', drag && 'is-dragging')}>
      {items.map((item, i) => (
        <div
          key={keyOf(item)}
          class={cx('reorder-row', drag?.from === i && 'is-lifted')}
          style={{ transform: `translateY(${offset(i)}px)` }}
        >
          <div class="reorder-row__body">{render(item)}</div>
          <span
            class="reorder-row__grip"
            role="button"
            aria-label={gripLabel}
            onPointerDown={(e) => down(e, i)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <Icon name="grip" size={20} />
          </span>
        </div>
      ))}
    </div>
  );
}
