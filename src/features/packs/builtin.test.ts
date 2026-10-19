import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { registeredCollections } from '@/core/store/store';
import type { Localized, PackItem } from '@/core/packs/types';
import '@/features/training/model';
import '@/features/schedule/model';
import '@/features/money/model';
import '@/features/nutrition/model';
import { BUILTIN_PACKS } from './builtin';

const LANGS: Record<string, (x: Localized) => string> = { ru: (x) => x.ru, en: (x) => x.en };
const LOCAL_PREFIXES = ['cat-', 'ex-', 'f-'];

/** All `*Id` string values anywhere inside an item (nested arrays/objects included). */
function refs(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((x) => refs(x, out));
  else if (value && typeof value === 'object') {
    for (const [k, x] of Object.entries(value)) {
      if (k.endsWith('Id') && typeof x === 'string') out.push(x);
      else refs(x, out);
    }
  }
  return out;
}

describe('builtin packs', () => {
  it('have unique ids', () => {
    expect(new Set(BUILTIN_PACKS.map((p) => p.id)).size).toBe(BUILTIN_PACKS.length);
  });

  for (const pack of BUILTIN_PACKS) {
    for (const [lang, L] of Object.entries(LANGS)) {
      it(`${pack.id} (${lang}) is valid`, () => {
        const input = pack.build(L);
        expect(input.name).toBeTruthy();
        const all = new Map<string, PackItem[]>();
        for (const [name, entry] of Object.entries(input.collections ?? {})) {
          const items = Array.isArray(entry) ? entry : entry.items;
          all.set(name, items);
          const schema = registeredCollections().find((c) => c.name === name)?.schema;
          expect(schema, `schema for ${name}`).toBeDefined();
          for (const item of items) {
            const res = v.safeParse(schema!, { ...item, id: item.id ?? 'x', createdAt: 0, updatedAt: 0 });
            expect(res.success, `${name}/${item.id}: ${JSON.stringify(res.issues?.map((i) => i.message))}`).toBe(true);
            if (name === 'foods') {
              const portions = (item.portions as { id: string }[]).map((p) => p.id);
              expect(new Set(portions).size).toBe(portions.length);
            }
          }
          const ids = items.map((i) => i.id);
          expect(new Set(ids).size, `unique ids in ${name}`).toBe(ids.length);
        }
        const known = new Set([...all.values()].flat().map((i) => i.id));
        for (const items of all.values()) {
          for (const ref of refs(items)) {
            if (LOCAL_PREFIXES.some((p) => ref.startsWith(p))) expect(known.has(ref), `ref ${ref}`).toBe(true);
          }
        }
        const slots = input.docs?.bells?.slots as { n: number; start: number; end: number }[] | undefined;
        if (slots) {
          slots.forEach((s, i) => {
            expect(s.n).toBe(i + 1);
            expect(s.start).toBeLessThan(s.end);
            if (i > 0) expect(s.start).toBeGreaterThanOrEqual(slots[i - 1]!.end);
          });
        }
      });
    }
  }
});
