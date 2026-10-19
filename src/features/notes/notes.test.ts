import { describe, expect, it } from 'vitest';
import { toISODate } from '@/core/date';
import { allTags, dropValues, isNoteEmpty, parseTags, searchNotes, sortNotes, staleFieldIds, validSort } from './logic';
import type { FieldDef } from './model';
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
    expect(searchNotes(list, '#книги').map((h) => h.note.id)).toEqual(['a']);
    expect(searchNotes(list, '#')).toEqual([]);
  });

  it('sorts pinned first, then by a field', () => {
    const fields = [{ id: 'rating', name: 'Оценка', type: 'rating' as const, options: [] }];
    expect(sortNotes(list, 'field:rating', fields).map((n) => n.id)).toEqual(['c', 'b', 'a']);
    expect(sortNotes(list, 'updated', fields).map((n) => n.id)).toEqual(['c', 'b', 'a']);
  });

  it('tags', () => {
    expect(parseTags('#Чтение, идеи, ИДЕИ')).toEqual(['чтение', 'идеи']);
    expect(parseTags('  личный   рост , #Книги,, ')).toEqual(['личный рост', 'книги']);
    expect(parseTags('##a b')).toEqual(['a b']);
    expect(parseTags('')).toEqual([]);
    expect(allTags([note({ tags: ['a', 'b'] }), note({ tags: ['b'] })])).toEqual(['b', 'a']);
  });

  it('empty notes', () => {
    expect(isNoteEmpty(note({ title: ' ', values: { a: null, b: false } }))).toBe(true);
    expect(isNoteEmpty(note({ tags: ['x'] }))).toBe(false);
    expect(isNoteEmpty(note({ pinned: true }))).toBe(false);
    expect(isNoteEmpty(note({ revisit: true }))).toBe(false);
    expect(isNoteEmpty(note({ values: { a: 0 } }))).toBe(false);
  });

  it('collection field changes', () => {
    const f = (id: string, type: FieldDef['type']): FieldDef => ({ id, name: id, type, options: [] });
    expect(staleFieldIds([f('a', 'text'), f('b', 'number'), f('c', 'rating')], [f('a', 'text'), f('b', 'text')])).toEqual(['b', 'c']);
    expect(validSort('field:b', [f('b', 'text')])).toBe('updated');
    expect(validSort('field:b', [f('b', 'number')])).toBe('field:b');
    expect(validSort('field:x', [])).toBe('updated');
    expect(validSort('date', [])).toBe('date');
    expect(dropValues({ a: 1, b: 'x' }, ['b', 'z'])).toEqual({ a: 1 });
    expect(dropValues({ a: 1 }, ['z'])).toBeNull();
  });
});
