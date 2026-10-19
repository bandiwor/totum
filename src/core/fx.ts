import { signal } from '@preact/signals';
import { settings } from './settings';

/**
 * Hooks for rewarding ("dopamine") effects. Every place that deserves a
 * celebration already calls `fx()`; the visuals are intentionally stubs for now.
 * To implement: render from `fxQueue` in <FxLayer/> (src/ui/FxLayer.tsx).
 */
export type FxKind =
  | 'task-done'
  | 'all-tasks-done'
  | 'set-done'
  | 'workout-done'
  | 'personal-record'
  | 'nutrition-goal'
  | 'water-goal'
  | 'savings-goal'
  | 'streak';

export interface FxEvent {
  id: number;
  kind: FxKind;
  /** Screen point the effect originates from (e.g. the tapped checkbox). */
  origin: { x: number; y: number } | null;
  at: number;
}

export const fxQueue = signal<readonly FxEvent[]>([]);
let seq = 0;

export function fx(kind: FxKind, origin: Element | { x: number; y: number } | null = null): void {
  if (!settings.value.value.effects) return;
  let point: FxEvent['origin'] = null;
  if (origin instanceof Element) {
    const r = origin.getBoundingClientRect();
    point = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  } else if (origin) point = origin;
  const event: FxEvent = { id: ++seq, kind, origin: point, at: Date.now() };
  // Keep only recent events; the layer consumes and clears them.
  fxQueue.value = [...fxQueue.value.slice(-8), event];
}

export function consumeFx(id: number): void {
  fxQueue.value = fxQueue.value.filter((e) => e.id !== id);
}
