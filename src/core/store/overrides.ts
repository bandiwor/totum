import * as v from 'valibot';
import { computed } from '@preact/signals';
import type { ISODate } from '../date';
import { newId } from '../id';
import type { DayOverride } from '../plan';
import { entityFields, isoDate } from './schema';
import { defineCollection, type Collection, type Entity } from './store';

/** Stored shape of a date-specific change on top of a template (see core/plan.ts). */
export interface OverrideRecord<T> extends Entity {
  date: ISODate;
  key: string;
  kind: 'add' | 'cancel' | 'modify';
  data: T | null;
  patch: Partial<T> | null;
}

/**
 * Per-feature store of day overrides: "cancel this class", "extra workout on
 * Thursday", "ate 50 g more". The template itself is never touched.
 */
export class OverrideStore<T extends object> {
  private readonly byDate = computed(() => {
    const map = new Map<string, OverrideRecord<T>[]>();
    for (const r of this.collection.all.value) {
      let list = map.get(r.date);
      if (!list) map.set(r.date, (list = []));
      list.push(r);
    }
    for (const list of map.values()) list.sort((a, b) => a.createdAt - b.createdAt);
    return map;
  });

  constructor(readonly collection: Collection<OverrideRecord<T>>) {}

  records(date: ISODate): readonly OverrideRecord<T>[] {
    return this.byDate.value.get(date) ?? [];
  }

  forDate(date: ISODate): DayOverride<T>[] {
    return this.records(date).map((r): DayOverride<T> => {
      switch (r.kind) {
        case 'add':
          return { kind: 'add', date, key: r.key, data: r.data as T };
        case 'cancel':
          return { kind: 'cancel', date, key: r.key };
        case 'modify':
          return { kind: 'modify', date, key: r.key, patch: r.patch ?? {} };
      }
    });
  }

  private find(date: ISODate, key: string, kind: OverrideRecord<T>['kind']): OverrideRecord<T> | undefined {
    return this.records(date).find((r) => r.key === key && r.kind === kind);
  }

  add(date: ISODate, data: T): string {
    const key = newId();
    this.collection.add({ date, key, kind: 'add', data, patch: null });
    return key;
  }

  modify(date: ISODate, key: string, patch: Partial<T>): void {
    const added = this.find(date, key, 'add');
    if (added) {
      this.collection.update(added.id, { data: { ...(added.data as T), ...patch } });
      return;
    }
    const existing = this.find(date, key, 'modify');
    if (existing) this.collection.update(existing.id, { patch: { ...existing.patch, ...patch } });
    else this.collection.add({ date, key, kind: 'modify', data: null, patch });
  }

  cancel(date: ISODate, key: string): void {
    const added = this.find(date, key, 'add');
    if (added) {
      this.collection.remove(added.id);
      return;
    }
    this.reset(date, key);
    this.collection.add({ date, key, kind: 'cancel', data: null, patch: null });
  }

  /** Back to the template for this item on this date. */
  reset(date: ISODate, key: string): void {
    for (const r of this.records(date)) if (r.key === key && r.kind !== 'add') this.collection.remove(r.id);
  }

  isCancelled(date: ISODate, key: string): boolean {
    return this.find(date, key, 'cancel') !== undefined;
  }
}

export function defineOverrides<T extends object>(
  name: string,
  label: string,
  dataEntries: v.ObjectEntries,
): OverrideStore<T> {
  const data = v.object(dataEntries);
  const collection = defineCollection<OverrideRecord<T>>(name, {
    label,
    schema: v.object({
      ...entityFields,
      date: isoDate,
      key: v.string(),
      kind: v.picklist(['add', 'cancel', 'modify']),
      data: v.nullable(data),
      patch: v.nullable(v.partial(data)),
    }),
  });
  return new OverrideStore<T>(collection);
}
