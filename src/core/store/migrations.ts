import { t } from '../i18n';
import type { DataSnapshot } from './store';

/**
 * Data schema version. Bump it and append a migration whenever the shape of
 * stored data changes. Old backups are migrated step by step on import, and the
 * local database is migrated on boot.
 */
export const SCHEMA_VERSION = 1;

type Migration = (data: DataSnapshot) => DataSnapshot;

/** migrations[n] upgrades data from version n+1 to n+2. */
const migrations: Migration[] = [];

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
