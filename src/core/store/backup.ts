import * as v from 'valibot';
import { newId } from '../id';
import { db, type StoredBackup } from './idb';
import { migrate, SCHEMA_VERSION } from './migrations';
import { registeredCollections, replaceAll, snapshotAll, type DataSnapshot } from './store';

const APP_ID = 'organizer';
const AUTO_BACKUPS_KEPT = 5;

const EnvelopeSchema = v.object({
  app: v.literal(APP_ID),
  schemaVersion: v.pipe(v.number(), v.integer(), v.minValue(1)),
  exportedAt: v.string(),
  collections: v.record(v.string(), v.array(v.unknown())),
  docs: v.record(v.string(), v.unknown()),
});

export type BackupEnvelope = v.InferOutput<typeof EnvelopeSchema>;

const EntityShape = v.looseObject({ id: v.pipe(v.string(), v.minLength(1)) });

export function exportJSON(): string {
  const envelope: BackupEnvelope = {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    ...snapshotAll(),
  };
  return JSON.stringify(envelope);
}

export interface ImportPreview {
  data: DataSnapshot;
  exportedAt: string;
  /** Per collection: label and record count. */
  counts: { name: string; label: string; count: number }[];
  warnings: string[];
}

/** Parses, migrates and validates pasted text. Throws a readable error on failure. */
export function parseBackup(text: string): ImportPreview {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    throw new Error('Это не JSON. Скопируй экспорт целиком, от { до }.');
  }
  const env = v.safeParse(EnvelopeSchema, raw);
  if (!env.success) throw new Error('Формат не похож на экспорт этого приложения.');

  const data = migrate({ collections: env.output.collections, docs: env.output.docs }, env.output.schemaVersion);
  const warnings: string[] = [];
  const known = new Map(registeredCollections().map((c) => [c.name, c]));

  for (const [name, items] of Object.entries(data.collections)) {
    const def = known.get(name);
    const schema = def?.schema ?? EntityShape;
    const ids = new Set<string>();
    items.forEach((item, i) => {
      const r = v.safeParse(schema, item);
      if (!r.success) {
        const issue = r.issues[0];
        throw new Error(`«${def?.label ?? name}», запись ${i + 1}: ${issue?.message ?? 'неверные данные'}`);
      }
      const id = (item as { id: string }).id;
      if (ids.has(id)) throw new Error(`«${def?.label ?? name}»: повторяется id ${id}`);
      ids.add(id);
    });
    if (!def) warnings.push(`Раздел «${name}» неизвестен этой версии — он сохранится, но не будет отображаться.`);
  }

  const counts = Object.entries(data.collections)
    .map(([name, items]) => ({ name, label: known.get(name)?.label ?? name, count: items.length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return { data, exportedAt: env.output.exportedAt, counts, warnings };
}

// ── Automatic local backups (made before every import / restore) ───────────

export async function createAutoBackup(reason: string): Promise<void> {
  const database = await db();
  await database.put('backups', { id: newId(), createdAt: Date.now(), reason, json: exportJSON() });
  const all = await database.getAllFromIndex('backups', 'byCreated');
  for (const old of all.slice(0, Math.max(0, all.length - AUTO_BACKUPS_KEPT))) {
    await database.delete('backups', old.id);
  }
}

export async function listAutoBackups(): Promise<StoredBackup[]> {
  const all = await (await db()).getAllFromIndex('backups', 'byCreated');
  return all.reverse();
}

/** Replaces all data; the current state is backed up first so it can be rolled back. */
export async function applyImport(preview: ImportPreview, reason = 'Перед импортом'): Promise<void> {
  await createAutoBackup(reason);
  await replaceAll(preview.data);
}
