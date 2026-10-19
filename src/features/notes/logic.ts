import { compareDates } from '@/core/date';
import type { FieldDef, FieldValue, Note, SortMode } from './model';

const norm = (s: string): string => s.toLowerCase().replace(/ё/g, 'е');

function valueText(v: FieldValue): string {
  return v === null || typeof v === 'boolean' ? '' : String(v);
}

export interface SearchHit {
  note: Note;
  /** Text around the first match in the body (or the matched field/tag). */
  snippet: string;
}

/** Case- and ё-insensitive search over title, body, tags and field values; every word must match. */
export function searchNotes(list: readonly Note[], query: string): SearchHit[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const note of list) {
    const values = Object.values(note.values).map(valueText);
    const haystack = norm([note.title, note.body, note.tags.join(' '), ...values].join('\n'));
    if (!words.every((w) => haystack.includes(w))) continue;
    hits.push({ note, snippet: snippet(note, words[0]!) });
  }
  return hits.sort((a, b) => b.note.updatedAt - a.note.updatedAt);
}

function snippet(note: Note, word: string): string {
  const body = note.body.replace(/\s+/g, ' ');
  const i = norm(body).indexOf(word);
  if (i < 0) return preview(note.body);
  const start = Math.max(0, i - 40);
  return `${start > 0 ? '…' : ''}${body.slice(start, i + 80).trim()}${i + 80 < body.length ? '…' : ''}`;
}

export function preview(body: string, length = 120): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length).trim()}…` : flat;
}

/** Pinned first, then by the collection's sort mode. */
export function sortNotes(list: readonly Note[], mode: SortMode, fields: readonly FieldDef[]): Note[] {
  const field = mode.startsWith('field:') ? fields.find((f) => f.id === mode.slice(6)) : undefined;
  const cmp = (a: Note, b: Note): number => {
    if (mode === 'title') return a.title.localeCompare(b.title, 'ru');
    if (mode === 'date') return compareDates(b.date, a.date) || b.createdAt - a.createdAt;
    if (field) {
      const av = a.values[field.id] ?? null;
      const bv = b.values[field.id] ?? null;
      if (av === null && bv === null) return b.updatedAt - a.updatedAt;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return bv - av;
      return String(av).localeCompare(String(bv), 'ru');
    }
    return b.updatedAt - a.updatedAt;
  };
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || cmp(a, b));
}

export function allTags(list: readonly Note[]): string[] {
  const counts = new Map<string, number>();
  for (const n of list) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru')).map(([t]) => t);
}

/** "#чтение, идеи" → ["чтение", "идеи"]. */
export function parseTags(input: string): string[] {
  return [...new Set(input.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))];
}
