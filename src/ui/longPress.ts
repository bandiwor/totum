import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { haptic } from '@/core/haptics';

const HOLD_MS = 450;
const SLOP = 8;

/**
 * Hold to open: fires `onLong` after a steady press and swallows the click
 * that follows, so the element's normal tap action doesn't run too.
 */
export function useLongPress(onLong: () => void): Pick<JSX.HTMLAttributes<HTMLElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onClickCapture' | 'onContextMenu'> {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  return {
    onPointerDown: (e) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = null;
        haptic('medium');
        onLong();
      }, HOLD_MS);
    },
    onPointerMove: (e) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onClickCapture: (e) => {
      if (!fired.current) return;
      fired.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
    onContextMenu: (e) => e.preventDefault(),
  };
}
