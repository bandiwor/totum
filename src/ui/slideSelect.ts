import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { haptic } from '@/core/haptics';

interface Gesture {
  pointerId: number;
  startX: number;
  /** Track geometry at press time. */
  left: number;
  col: number;
  dragging: boolean;
}

export interface SlideSelect {
  /** Index to render as active: the hovered one while dragging. */
  shown: number;
  pressed: boolean;
  /** Thumb offset in px while dragging, else null (use the CSS index position). */
  thumbX: number | null;
  /** True when the dragged thumb sits (almost) right over `shown`. */
  centered: boolean;
  handlers: Pick<
    JSX.HTMLAttributes<HTMLElement>,
    'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onClickCapture'
  >;
}

/**
 * iOS-style selection: press the selected segment and slide the thumb to
 * another one; release selects it. Taps keep working as plain clicks.
 * The element with the handlers is the track; `inset` is its horizontal padding.
 */
export function useSlideSelect(count: number, index: number, onSelect: (i: number) => void, inset: number): SlideSelect {
  const g = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [thumbX, setThumbX] = useState<number | null>(null);
  const [hovered, setHovered] = useState(index);
  const [pressed, setPressed] = useState(false);
  const [pos, setPos] = useState(0);

  const geometry = (el: HTMLElement): { left: number; col: number } => {
    const r = el.getBoundingClientRect();
    return { left: r.left + inset, col: (r.width - 2 * inset) / count };
  };

  const end = (commit: boolean): void => {
    const cur = g.current;
    g.current = null;
    setPressed(false);
    if (cur?.dragging) {
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      if (commit && hovered !== index) onSelect(hovered);
    }
    setThumbX(null);
  };

  return {
    shown: thumbX === null ? index : hovered,
    pressed,
    thumbX,
    centered: thumbX === null || Math.abs(pos - hovered) < 0.2,
    handlers: {
      onPointerDown: (e) => {
        if (count < 2 || e.button > 0) return;
        const el = e.currentTarget as HTMLElement;
        const { left, col } = geometry(el);
        // Only a press on the selected segment grabs the thumb.
        if (Math.floor((e.clientX - left) / col) !== index) return;
        g.current = { pointerId: e.pointerId, startX: e.clientX, left, col, dragging: false };
        setHovered(index);
        setPressed(true);
      },
      onPointerMove: (e) => {
        const cur = g.current;
        if (!cur || cur.pointerId !== e.pointerId) return;
        const dx = e.clientX - cur.startX;
        if (!cur.dragging) {
          if (Math.abs(dx) < 6) return;
          cur.dragging = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
        const x = Math.max(0, Math.min((count - 1) * cur.col, index * cur.col + dx));
        const next = Math.round(x / cur.col);
        if (next !== hovered) {
          haptic('selection');
          setHovered(next);
        }
        setThumbX(x);
        setPos(x / cur.col);
      },
      onPointerUp: () => end(true),
      onPointerCancel: () => end(false),
      onClickCapture: (e) => {
        if (!suppressClick.current) return;
        e.stopPropagation();
        e.preventDefault();
      },
    },
  };
}
