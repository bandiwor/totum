import { t } from '../i18n';
import type { DataSnapshot } from './store';

/**
 * Data schema version. Bump it and append a migration whenever the shape of
 * stored data changes. Old backups are migrated step by step on import, and the
 * local database is migrated on boot.
 */
export const SCHEMA_VERSION = 3;

type Migration = (data: DataSnapshot) => DataSnapshot;

/** migrations[n] upgrades data from version n+1 to n+2. */
const migrations: Migration[] = [
  // 1 → 2: sleep entries stored clock minutes under the morning date; now they are
  // sessions with absolute timestamps (naps and any-time sleep).
  (data) => {
    const old = data.collections.sleepLog;
    if (!old) return data;
    const at = (date: string, m: number): number => {
      const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
      return new Date(y, mo - 1, d, 0, m).getTime();
    };
    const sleepLog = old.flatMap((raw) => {
      const e = raw as { id: string; createdAt: number; updatedAt: number; date: string; plannedBed: number; plannedWake: number; bedAt: number | null; asleepAt: number | null; wakeAt: number | null };
      // Evening times belong to the day before the morning the night was filed under.
      const evening = (m: number | null): number | null => {
        if (m === null) return null;
        const [y, mo, d] = e.date.split('-').map(Number) as [number, number, number];
        return m >= 720 ? new Date(y, mo - 1, d - 1, 0, m).getTime() : at(e.date, m);
      };
      const bed = evening(e.bedAt) ?? evening(e.asleepAt);
      if (bed === null) return [];
      return [{ id: e.id, createdAt: e.createdAt, updatedAt: e.updatedAt, plannedBed: e.plannedBed, plannedWake: e.plannedWake, bedAt: bed, asleepAt: evening(e.asleepAt), wakeAt: e.wakeAt === null ? null : at(e.date, e.wakeAt) }];
    });
    return { ...data, collections: { ...data.collections, sleepLog } };
  },
  // 2 → 3: a subject's teacher was free text; teachers are now a list (with a position).
  (data) => {
    const subjects = data.collections.subjects;
    if (!subjects) return data;
    const teachers: { id: string; createdAt: number; updatedAt: number; name: string; position: string }[] = [];
    const byName = new Map<string, string>();
    const migrated = subjects.map((raw) => {
      const { teacher, ...rest } = raw as { teacher?: string; createdAt: number } & Record<string, unknown>;
      const name = (teacher ?? '').trim();
      if (!name) return { ...rest, teacherId: null };
      let id = byName.get(name.toLowerCase());
      if (!id) {
        id = `tch-${teachers.length + 1}-${Date.now().toString(36)}`;
        byName.set(name.toLowerCase(), id);
        teachers.push({ id, createdAt: rest.createdAt, updatedAt: rest.createdAt, name, position: '' });
      }
      return { ...rest, teacherId: id };
    });
    return { ...data, collections: { ...data.collections, subjects: migrated, teachers: [...(data.collections.teachers ?? []), ...teachers] } };
  },
];

export function migrate(data: DataSnapshot, fromVersion: number): DataSnapshot {
  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(t('backup.newerSchema', { version: fromVersion }));
  }
  let out = data;
  for (let v = fromVersion; v < SCHEMA_VERSION; v++) {
    const step = migrations[v - 1];
    if (!step) throw new Error(t('backup.noMigration', { from: v, to: v + 1 }));
    out = step(out);
  }
  return out;
}
