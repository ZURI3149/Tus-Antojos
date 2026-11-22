import type { OfflineDb } from './db';
import type { Snapshot } from './types';

/** Última lectura correcta de una consulta, para usarla sin red (SPEC-offline-print OP-D10). */
export interface SnapshotStore {
  save<T>(key: string, data: T, now?: Date): Promise<void>;
  load<T>(key: string): Promise<Snapshot<T> | null>;
}

export function createSnapshotStore(dbPromise: Promise<OfflineDb>): SnapshotStore {
  return {
    async save(key, data, now = new Date()) {
      const db = await dbPromise;
      await db.put('snapshots', { key, savedAt: now.toISOString(), data });
    },
    async load<T>(key: string) {
      const db = await dbPromise;
      return ((await db.get('snapshots', key)) as Snapshot<T> | undefined) ?? null;
    },
  };
}
