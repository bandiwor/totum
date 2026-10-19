import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * One generic record store keyed by [collection, id]. New collections and
 * features never require an IndexedDB version bump.
 */
export interface StoredRecord {
  c: string;
  id: string;
  v: unknown;
}

export interface StoredBackup {
  id: string;
  createdAt: number;
  reason: string;
  json: string;
}

interface OrganizerDB extends DBSchema {
  records: { key: [string, string]; value: StoredRecord; indexes: { byCollection: string } };
  backups: { key: string; value: StoredBackup; indexes: { byCreated: number } };
}

let dbPromise: Promise<IDBPDatabase<OrganizerDB>> | null = null;

export function db(): Promise<IDBPDatabase<OrganizerDB>> {
  dbPromise ??= openDB<OrganizerDB>('totum', 1, {
    upgrade(database) {
      const records = database.createObjectStore('records', { keyPath: ['c', 'id'] });
      records.createIndex('byCollection', 'c');
      const backups = database.createObjectStore('backups', { keyPath: 'id' });
      backups.createIndex('byCreated', 'createdAt');
    },
  });
  return dbPromise;
}
