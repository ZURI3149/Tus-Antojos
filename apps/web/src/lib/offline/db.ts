import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { OUTBOX_SCHEMA_VERSION, type OutboxEntry, type OutboxStatus, type Snapshot } from './types';

export const OFFLINE_DB_NAME = 'tus-antojos';

export interface OfflineDbSchema extends DBSchema {
  outbox: {
    key: string;
    value: OutboxEntry;
    indexes: { 'by-enqueuedAt': string; 'by-status': OutboxStatus };
  };
  snapshots: {
    key: string;
    value: Snapshot;
  };
}

export type OfflineDb = IDBPDatabase<OfflineDbSchema>;
export type UpgradeTransaction = IDBPTransaction<
  OfflineDbSchema,
  ('outbox' | 'snapshots')[],
  'versionchange'
>;

/**
 * Una migración por versión de la base. Corre dentro de la transacción `versionchange`:
 * solo puede esperar operaciones de IndexedDB (nada de `fetch` ni temporizadores).
 */
export type Migration = (db: OfflineDb, tx: UpgradeTransaction) => void | Promise<void>;

export const MIGRATIONS: Record<number, Migration> = {
  1: (db) => {
    const outbox = db.createObjectStore('outbox', { keyPath: 'clientOrderId' });
    outbox.createIndex('by-enqueuedAt', 'enqueuedAt');
    outbox.createIndex('by-status', 'status');
    db.createObjectStore('snapshots', { keyPath: 'key' });
  },
};

export interface OpenOfflineDbOptions {
  name?: string;
  version?: number;
  /** Se suman a `MIGRATIONS` (las pruebas agregan versiones futuras). */
  migrations?: Record<number, Migration>;
}

/** Abre la base offline aplicando en orden las migraciones pendientes. */
export function openOfflineDb(options: OpenOfflineDbOptions = {}): Promise<OfflineDb> {
  const version = options.version ?? OUTBOX_SCHEMA_VERSION;
  const migrations = { ...MIGRATIONS, ...options.migrations };

  return openDB<OfflineDbSchema>(options.name ?? OFFLINE_DB_NAME, version, {
    async upgrade(db, oldVersion, newVersion, tx) {
      for (let v = oldVersion + 1; v <= (newVersion ?? version); v++) {
        const migrate = migrations[v];
        if (!migrate) throw new Error(`Falta la migración de la base offline a la versión ${v}`);
        await migrate(db, tx);
      }
    },
  });
}
