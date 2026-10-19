import * as v from 'valibot';
import { t } from '../i18n';
import { newId } from '../id';
import { createAutoBackup } from '../store/backup';
import { registeredCollections, registeredDocs, replaceAll, snapshotAll } from '../store/store';
import type { PackInput, PackItem, PackMode } from './types';

/**
 * Applying a content pack (docs/PACKS.md) = a dry run that shows, per section,
 * what would be added, changed or removed — then writing the chosen sections
 * in one atomic replace (after an automatic backup).
 */

export interface ItemChange {
  id: string;
  title: string;
  /** Changed fields (for "changed" entries). */
  fields: string[];
}

export interface PackSection {
  /** "c:<collection>" or "d:<doc>". */
  key: string;
  kind: 'collection' | 'doc';
  name: string;
  added: ItemChange[];
  changed: ItemChange[];
  removed: ItemChange[];
  /** The section's content after applying (items or doc value). */
  next: unknown;
}

export interface PackPlan {
  name: string;
  description: string;
  /** Only sections where something changes. */
  sections: PackSection[];
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

function stable(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (isObj(x)) return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}`;
  return JSON.stringify(x) ?? 'null';
}
const same = (a: unknown, b: unknown): boolean => stable(a) === stable(b);

const BOOKKEEPING = new Set(['createdAt', 'updatedAt']);

function titleOf(item: Obj): string {
  for (const k of ['name', 'title', 'date']) if (typeof item[k] === 'string' && item[k]) return item[k];
  return String(item.id ?? '');
}

const matchKey = (item: Obj): string | null => {
  const title = typeof item.name === 'string' ? item.name : typeof item.title === 'string' ? item.title : null;
  return title ? title.trim().toLocaleLowerCase() : null;
};

/** Replaces pack-local ids in every `…Id` / `…Ids` field with the ids they were matched to. */
function remapRefs(value: unknown, remap: ReadonlyMap<string, string>): unknown {
  if (Array.isArray(value)) return value.map((x) => remapRefs(x, remap));
  if (!isObj(value)) return value;
  const out: Obj = {};
  for (const [k, x] of Object.entries(value)) {
    if (k.endsWith('Id') && typeof x === 'string') out[k] = remap.get(x) ?? x;
    else if (k.endsWith('Ids') && Array.isArray(x)) out[k] = x.map((id) => (typeof id === 'string' ? (remap.get(id) ?? id) : id));
    else out[k] = remapRefs(x, remap);
  }
  return out;
}

function parseInput(input: string | PackInput): PackInput {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input.trim());
    } catch {
      throw new Error(t('backup.notJson'));
    }
  }
  if (!isObj(raw)) throw new Error(t('packs.badFormat'));
  if (raw.app === 'totum') throw new Error(t('packs.isBackup'));
  if (raw.collections !== undefined && !isObj(raw.collections)) throw new Error(t('packs.badFormat'));
  if (raw.docs !== undefined && !isObj(raw.docs)) throw new Error(t('packs.badFormat'));
  if (raw.settings !== undefined && !isObj(raw.settings)) throw new Error(t('packs.badFormat'));
  if (!raw.collections && !raw.docs && !raw.settings) throw new Error(t('packs.empty'));
  return raw as PackInput;
}

/** Dry run: validates the pack against the current data and lists the changes. Throws readable errors. */
export function planPack(input: string | PackInput): PackPlan {
  const pack = parseInput(input);
  const now = Date.now();
  const snap = snapshotAll();
  const known = new Map(registeredCollections().map((c) => [c.name, c]));
  const knownDocs = new Map(registeredDocs().map((d) => [d.name, d]));

  // 1. Normalise collections and match every item to an existing one (by id, then by name).
  interface Entry { item: Obj; targetId: string; existing: Obj | undefined }
  const plans: { name: string; mode: PackMode; entries: Entry[] }[] = [];
  const remap = new Map<string, string>();

  for (const [name, spec] of Object.entries(pack.collections ?? {})) {
    if (!known.has(name)) throw new Error(t('packs.unknownCollection', { name, known: [...known.keys()].join(', ') }));
    const items: unknown = Array.isArray(spec) ? spec : isObj(spec) ? spec.items : undefined;
    const mode: PackMode = !Array.isArray(spec) && isObj(spec) && spec.mode === 'replace' ? 'replace' : 'merge';
    if (!Array.isArray(items)) throw new Error(t('packs.badCollection', { name }));

    const existing = (snap.collections[name] ?? []) as Obj[];
    const byId = new Map(existing.map((x) => [String(x.id), x]));
    const byTitle = new Map<string, Obj>();
    for (const x of existing) {
      const key = matchKey(x);
      if (key && !byTitle.has(key)) byTitle.set(key, x);
    }

    const taken = new Set<string>();
    const entries: Entry[] = items.map((raw, i) => {
      if (!isObj(raw)) throw new Error(t('packs.badItem', { name, n: i + 1 }));
      const item = raw as PackItem;
      const ownId = typeof item.id === 'string' && item.id ? item.id : null;
      let target = ownId ? byId.get(ownId) : undefined;
      if (!target) {
        const key = matchKey(item);
        target = key ? byTitle.get(key) : undefined;
        if (target && ownId) remap.set(ownId, String(target.id));
      }
      const targetId = target ? String(target.id) : (ownId ?? newId());
      if (taken.has(targetId)) throw new Error(t('packs.duplicate', { name, title: titleOf(item) }));
      taken.add(targetId);
      return { item, targetId, existing: target };
    });
    plans.push({ name, mode, entries });
  }

  const sections: PackSection[] = [];

  // 2. Merge, validate, diff.
  for (const { name, mode, entries } of plans) {
    const def = known.get(name)!;
    const label = t(def.label);
    const existing = (snap.collections[name] ?? []) as Obj[];
    const result = new Map(existing.map((x) => [String(x.id), x]));
    const section: PackSection = { key: `c:${name}`, kind: 'collection', name, added: [], changed: [], removed: [], next: null };

    for (const { item, targetId, existing: cur } of entries) {
      const fields = remapRefs(Object.fromEntries(Object.entries(item).filter(([k]) => !BOOKKEEPING.has(k) && k !== 'id')), remap) as Obj;
      const merged: Obj = cur ? { ...cur, ...fields, id: targetId, updatedAt: now } : { ...fields, id: targetId, createdAt: now, updatedAt: now };
      const checked = def.schema ? v.safeParse(def.schema, merged) : { success: true as const, output: merged };
      if (!checked.success) {
        const issue = checked.issues[0];
        const path = issue?.path?.map((p) => String(p.key)).join('.') ?? '';
        throw new Error(t('packs.badRecord', { section: label, title: titleOf(merged), message: `${path ? `${path}: ` : ''}${issue?.message ?? ''}` }));
      }
      const next = checked.output as Obj;
      if (cur) {
        const changed = Object.keys(next).filter((k) => !BOOKKEEPING.has(k) && !same(cur[k], next[k]));
        if (changed.length === 0) continue;
        section.changed.push({ id: targetId, title: titleOf(next), fields: changed });
      } else {
        section.added.push({ id: targetId, title: titleOf(next), fields: [] });
      }
      result.set(targetId, next);
    }

    if (mode === 'replace') {
      const kept = new Set(entries.map((e) => e.targetId));
      for (const x of existing) {
        const id = String(x.id);
        if (kept.has(id)) continue;
        result.delete(id);
        section.removed.push({ id, title: titleOf(x), fields: [] });
      }
    }

    section.next = [...result.values()];
    if (section.added.length + section.changed.length + section.removed.length > 0) sections.push(section);
  }

  // 3. Documents (settings is a doc too): field-wise patches checked against the defaults' types.
  const docPatches: [string, Obj][] = [...(pack.settings ? [['settings', pack.settings] as [string, Obj]] : []), ...Object.entries(pack.docs ?? {})];
  for (const [name, patch] of docPatches) {
    const def = knownDocs.get(name);
    if (!def) throw new Error(t('packs.unknownDoc', { name }));
    if (!isObj(patch)) throw new Error(t('packs.badCollection', { name }));
    const defaults = def.defaults as Obj;
    const cur = { ...defaults, ...((snap.docs[name] as Obj | undefined) ?? {}) };
    const remapped = remapRefs(patch, remap) as Obj;
    const changed: string[] = [];
    for (const [k, x] of Object.entries(remapped)) {
      const d = defaults[k];
      const ok = k in defaults && (d === null || (Array.isArray(d) ? Array.isArray(x) : typeof x === typeof d && (x !== null || d === null)));
      if (!ok) throw new Error(t('packs.badField', { section: name, field: k }));
      if (!same(cur[k], x)) changed.push(k);
    }
    if (changed.length === 0) continue;
    sections.push({
      key: `d:${name}`,
      kind: 'doc',
      name,
      added: [],
      changed: changed.map((k) => ({ id: k, title: k, fields: [k] })),
      removed: [],
      next: { ...cur, ...remapped },
    });
  }

  return { name: pack.name?.trim() || t('packs.untitled'), description: pack.description?.trim() ?? '', sections };
}

/** Writes the chosen sections atomically; the current data is backed up first. */
export async function applyPack(plan: PackPlan, include: ReadonlySet<string>): Promise<void> {
  await createAutoBackup(t('packs.beforeApply', { name: plan.name }));
  const snap = snapshotAll();
  for (const s of plan.sections) {
    if (!include.has(s.key)) continue;
    if (s.kind === 'collection') snap.collections[s.name] = s.next as unknown[];
    else snap.docs[s.name] = s.next;
  }
  await replaceAll(snap);
}
