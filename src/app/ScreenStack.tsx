import type { ComponentType } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { RouteProps } from '@/core/registry';
import type { NavDirection } from '@/core/router';
import { cx } from '@/ui';

interface Entry {
  key: string;
  Screen: ComponentType<RouteProps>;
  params: Record<string, string>;
  phase: 'enter' | 'idle' | 'leave';
  dir: NavDirection;
}

/** Matches the longest leave animation in app.css. */
const LEAVE_MS = 300;

/**
 * Keeps the previous screen mounted (same DOM, same scroll) while it animates
 * out and the new one animates in.
 */
export function ScreenStack({ current, Screen, params, dir }: { current: string; Screen: ComponentType<RouteProps>; params: Record<string, string>; dir: NavDirection }) {
  const stack = useRef<Entry[]>([]);
  const [, rerender] = useState(0);

  const top = stack.current[stack.current.length - 1];
  if (!top || top.key !== current) {
    const first = stack.current.length === 0;
    stack.current = [
      ...stack.current.filter((e) => e.key !== current).map((e): Entry => ({ ...e, phase: 'leave', dir })),
      { key: current, Screen, params, phase: first ? 'idle' : 'enter', dir },
    ];
  }

  useEffect(() => {
    if (!stack.current.some((e) => e.phase === 'leave')) return;
    const timer = setTimeout(() => {
      stack.current = stack.current.filter((e) => e.phase !== 'leave');
      rerender((n) => n + 1);
    }, LEAVE_MS);
    return () => clearTimeout(timer);
  }, [current]);

  return (
    <>
      {stack.current.map((e) => (
        <div key={e.key} class={cx('app__screen', e.phase !== 'idle' && `screen--${e.phase}-${e.dir}`)} aria-hidden={e.phase === 'leave'}>
          <e.Screen params={e.params} />
        </div>
      ))}
    </>
  );
}
