import type { ISODate } from './date';

/**
 * "Plan → actual" for one day. A template (usually a cycle day) yields planned
 * items; date-specific overrides add, cancel or modify them without touching
 * the template. Used by: classes, workouts, work shifts, meals, intakes.
 */
export type DayOverride<T> =
  | { kind: 'add'; date: ISODate; key: string; data: T }
  | { kind: 'cancel'; date: ISODate; key: string }
  | { kind: 'modify'; date: ISODate; key: string; patch: Partial<T> };

export interface PlannedItem<T> {
  /** Stable key of the template item (or of the added item). */
  key: string;
  data: T;
  origin: 'template' | 'added';
  modified: boolean;
}

export function resolveDay<T>(
  template: readonly { key: string; data: T }[],
  overrides: readonly DayOverride<T>[],
): PlannedItem<T>[] {
  const result = new Map<string, PlannedItem<T>>();
  for (const item of template) {
    result.set(item.key, { key: item.key, data: item.data, origin: 'template', modified: false });
  }
  for (const o of overrides) {
    switch (o.kind) {
      case 'add':
        result.set(o.key, { key: o.key, data: o.data, origin: 'added', modified: false });
        break;
      case 'cancel':
        result.delete(o.key);
        break;
      case 'modify': {
        const cur = result.get(o.key);
        if (cur) result.set(o.key, { ...cur, data: { ...cur.data, ...o.patch }, modified: true });
        break;
      }
    }
  }
  return [...result.values()];
}
