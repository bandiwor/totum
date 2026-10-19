import * as v from 'valibot';
import { computed } from '@preact/signals';
import { defineCollection, type Entity } from '@/core/store/store';

/**
 * Places and travel times. Any busy block can reference a place (university
 * building, gym, work…); the timeline engine inserts travel between them.
 */
export interface Place extends Entity {
  name: string;
  isHome: boolean;
}

export interface Route extends Entity {
  fromId: string;
  toId: string;
  minutes: number;
  /** Same time in both directions (default). */
  bothWays: boolean;
}

const entity = { id: v.string(), createdAt: v.number(), updatedAt: v.number() };

export const places = defineCollection<Place>('places', {
  label: 'Места',
  schema: v.object({ ...entity, name: v.string(), isHome: v.boolean() }),
});

export const routes = defineCollection<Route>('routes', {
  label: 'Дорога между местами',
  schema: v.object({
    ...entity,
    fromId: v.string(),
    toId: v.string(),
    minutes: v.pipe(v.number(), v.minValue(0)),
    bothWays: v.boolean(),
  }),
});

export const homeId = computed(() => places.all.value.find((p) => p.isHome)?.id ?? null);

const travelIndex = computed(() => {
  const map = new Map<string, number>();
  for (const r of routes.all.value) {
    map.set(`${r.fromId}>${r.toId}`, r.minutes);
    if (r.bothWays && !map.has(`${r.toId}>${r.fromId}`)) map.set(`${r.toId}>${r.fromId}`, r.minutes);
  }
  return map;
});

export function travelMinutes(from: string, to: string): number | undefined {
  return travelIndex.value.get(`${from}>${to}`);
}
