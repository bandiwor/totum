import * as v from 'valibot';
import { computed } from '@preact/signals';
import type { ISODate } from '@/core/date';
import { entityFields, isoDate } from '@/core/store/schema';
import { defineCollection, type Entity } from '@/core/store/store';

export type FieldType = 'rating' | 'text' | 'number' | 'choice' | 'date' | 'checkbox' | 'link';
export const FIELD_TYPES: readonly FieldType[] = ['rating', 'text', 'number', 'choice', 'date', 'checkbox', 'link'];

/** A custom field of a collection (e.g. "Оценка" for perfumes, "Глава" for a book). */
export interface FieldDef {
  id: string;
  name: string;
  type: FieldType;
  /** Options for `choice`. */
  options: string[];
}

export type FieldValue = string | number | boolean | null;

export type SortMode = 'updated' | 'date' | 'title' | `field:${string}`;

export interface NoteCollection extends Entity {
  name: string;
  icon: string;
  color: string;
  fields: FieldDef[];
  sort: SortMode;
  archived: boolean;
}

const fieldSchema = v.object({
  id: v.string(),
  name: v.string(),
  type: v.picklist(['rating', 'text', 'number', 'choice', 'date', 'checkbox', 'link']),
  options: v.array(v.string()),
});

export const noteCollections = defineCollection<NoteCollection>('noteCollections', {
  label: 'collections.noteCollections',
  schema: v.object({
    ...entityFields,
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    fields: v.array(fieldSchema),
    sort: v.string(),
    archived: v.boolean(),
  }),
});

export interface Note extends Entity {
  collectionId: string;
  title: string;
  body: string;
  tags: string[];
  date: ISODate;
  /** "Come back to this": re-read, re-try, re-check. */
  revisit: boolean;
  pinned: boolean;
  values: Record<string, FieldValue>;
}

export const notes = defineCollection<Note>('notes', {
  label: 'collections.notes',
  schema: v.object({
    ...entityFields,
    collectionId: v.string(),
    title: v.string(),
    body: v.string(),
    tags: v.array(v.string()),
    date: isoDate,
    revisit: v.boolean(),
    pinned: v.boolean(),
    values: v.record(v.string(), v.nullable(v.union([v.string(), v.number(), v.boolean()]))),
  }),
});

export const activeCollections = computed(() =>
  noteCollections.all.value.filter((c) => !c.archived).sort((a, b) => a.createdAt - b.createdAt),
);

export const archivedCollections = computed(() =>
  noteCollections.all.value.filter((c) => c.archived).sort((a, b) => a.createdAt - b.createdAt),
);

/** Notes outside archived collections — what search and "revisit" look at. */
export const visibleNotes = computed(() => {
  const archived = new Set(archivedCollections.value.map((c) => c.id));
  return archived.size ? notes.all.value.filter((n) => !archived.has(n.collectionId)) : notes.all.value;
});

export const notesByCollection = computed(() => {
  const map = new Map<string, Note[]>();
  for (const n of notes.all.value) {
    let list = map.get(n.collectionId);
    if (!list) map.set(n.collectionId, (list = []));
    list.push(n);
  }
  return map;
});

export const revisitNotes = computed(() => visibleNotes.value.filter((n) => n.revisit).sort((a, b) => b.updatedAt - a.updatedAt));
