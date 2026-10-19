import { describe, expect, it } from 'vitest';
import { toISODate } from '@/core/date';
import { allTags, parseTags, searchNotes, sortNotes } from './logic';
import type { Note } from './model';

const note = (o: Partial<Note>): Note => ({
  id: Math.random().toString(), createdAt: 0, updatedAt: 0, collectionId: 'c', title: '', body: '', tags: [],
  date: toISODate('2026-10-19'), revisit: false, pinned: false, values: {}, ...o,
});

describe('notes', () => {
  const list = [
    note({ id: 'a', title: 'Атомные привычки', body: 'Привычка — это сложный процент самосовершенствования.', tags: ['книги'], updatedAt: 1 }),
    note({ id: 'b', title: 'Baccarat Rouge', body: 'Шафран, амбра, кедр', values: { brand: 'Maison Francis Kurkdjian', rating: 5 }, updatedAt: 2 }),
    note({ id: 'c', title: 'Ёлка', body: 'зимний вечер', pinned: true, values: { rating: 3 }, updatedAt: 0 }),
  ];

  it('searches title, body, tags and fields; all words must match; ё = е', () => {
    expect(searchNotes(list, 'процент').map((h) => h.note.id)).toEqual(['a']);
    expect(searchNotes(list, 'kurkdjian').map((h) => h.note.id)).toEqual(['b']);
    expect(searchNotes(list, 'книги привычка').map((h) => h.note.id)).toEqual(['a']);
    expect(searchNotes(list, 'книги шафран')).toEqual([]);
    expect(searchNotes(list, 'елка').map((h) => h.note.id)).toEqual(['c']);
  });

  it('sorts pinned first, then by a field', () => {
    const fields = [{ id: 'rating', name: 'Оценка', type: 'rating' as const, options: [] }];
    expect(sortNotes(list, 'field:rating', fields).map((n) => n.id)).toEqual(['c', 'b', 'a']);
    expect(sortNotes(list, 'updated', fields).map((n) => n.id)).toEqual(['c', 'b', 'a']);
  });

  it('tags', () => {
    expect(parseTags('#Чтение, идеи  идеи')).toEqual(['чтение', 'идеи']);
    expect(allTags([note({ tags: ['a', 'b'] }), note({ tags: ['b'] })])).toEqual(['b', 'a']);
  });
});
