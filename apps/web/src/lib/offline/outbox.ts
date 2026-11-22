import type { OfflineDb } from './db';
import { OUTBOX_SCHEMA_VERSION, type NewOutboxEntry, type OutboxEntry } from './types';

export interface Outbox {
  /** Encola un pedido cobrado. Si su `clientOrderId` ya está, devuelve la entrada existente. */
  enqueue(input: NewOutboxEntry, now?: Date): Promise<OutboxEntry>;
  get(clientOrderId: string): Promise<OutboxEntry | undefined>;
  /** Todas las entradas en orden FIFO (por hora de encolado). */
  list(): Promise<OutboxEntry[]>;
  /** Entradas `pendiente` + `enviando` (las "por revisar" no cuentan), opcionalmente de un cajero. */
  countPending(cashierId?: string): Promise<number>;
  markSending(clientOrderId: string): Promise<void>;
  /** La API confirmó el pedido (201/200): sale de la cola. */
  markDone(clientOrderId: string): Promise<void>;
  /** Falla transitoria (red, 5xx): vuelve a `pendiente` con un intento más. */
  scheduleRetry(clientOrderId: string, info: { error: string; nextAttemptAt: Date }): Promise<void>;
  /** Error de negocio (409/422/400): no se reintenta solo. */
  markForReview(clientOrderId: string, error: string): Promise<void>;
  /** Reintento manual de una entrada por revisar. */
  retry(clientOrderId: string, now?: Date): Promise<void>;
  /** Entradas que quedaron `enviando` (pestaña cerrada a mitad) vuelven a `pendiente`. */
  resetInterrupted(): Promise<number>;
  /** Saca una entrada a mano, con motivo; devuelve lo descartado para registrarlo. */
  discard(clientOrderId: string, reason: string): Promise<{ entry: OutboxEntry; reason: string }>;
  /** Avisa después de cada cambio. Devuelve la función para dejar de escuchar. */
  subscribe(listener: () => void): () => void;
}

const DISCARD_REASON_MIN = 3;
const DISCARD_REASON_MAX = 200;

export function createOutbox(dbPromise: Promise<OfflineDb>): Outbox {
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  /** Lee, transforma y guarda una entrada en una sola transacción; no hace nada si no existe. */
  async function update(
    clientOrderId: string,
    change: (entry: OutboxEntry) => OutboxEntry,
  ): Promise<void> {
    const db = await dbPromise;
    const tx = db.transaction('outbox', 'readwrite');
    const entry = await tx.store.get(clientOrderId);
    if (entry) await tx.store.put(change(entry));
    await tx.done;
    if (entry) notify();
  }

  return {
    async enqueue(input, now = new Date()) {
      const clientOrderId = input.body.clientOrderId;
      if (!clientOrderId) throw new Error('El pedido no tiene clientOrderId');

      const db = await dbPromise;
      const tx = db.transaction('outbox', 'readwrite');
      const existing = await tx.store.get(clientOrderId);
      if (existing) {
        await tx.done;
        return existing;
      }

      const iso = now.toISOString();
      const entry: OutboxEntry = {
        schemaVersion: OUTBOX_SCHEMA_VERSION,
        clientOrderId,
        body: input.body,
        cashierId: input.cashierId,
        cashierName: input.cashierName,
        charged: input.charged,
        enqueuedAt: iso,
        attempts: 0,
        nextAttemptAt: iso,
        status: 'pendiente',
        lastError: null,
      };
      await tx.store.add(entry);
      await tx.done;
      notify();
      return entry;
    },

    async get(clientOrderId) {
      const db = await dbPromise;
      return db.get('outbox', clientOrderId);
    },

    async list() {
      const db = await dbPromise;
      return db.getAllFromIndex('outbox', 'by-enqueuedAt');
    },

    async countPending(cashierId) {
      const entries = await this.list();
      return entries.filter(
        (e) => e.status !== 'por_revisar' && (cashierId === undefined || e.cashierId === cashierId),
      ).length;
    },

    markSending(clientOrderId) {
      return update(clientOrderId, (e) => ({ ...e, status: 'enviando' }));
    },

    async markDone(clientOrderId) {
      const db = await dbPromise;
      await db.delete('outbox', clientOrderId);
      notify();
    },

    scheduleRetry(clientOrderId, { error, nextAttemptAt }) {
      return update(clientOrderId, (e) => ({
        ...e,
        status: 'pendiente',
        attempts: e.attempts + 1,
        lastError: error,
        nextAttemptAt: nextAttemptAt.toISOString(),
      }));
    },

    markForReview(clientOrderId, error) {
      return update(clientOrderId, (e) => ({ ...e, status: 'por_revisar', lastError: error }));
    },

    retry(clientOrderId, now = new Date()) {
      return update(clientOrderId, (e) => ({
        ...e,
        status: 'pendiente',
        lastError: null,
        nextAttemptAt: now.toISOString(),
      }));
    },

    async resetInterrupted() {
      const db = await dbPromise;
      const tx = db.transaction('outbox', 'readwrite');
      const sending = await tx.store.index('by-status').getAll('enviando');
      for (const entry of sending) await tx.store.put({ ...entry, status: 'pendiente' });
      await tx.done;
      if (sending.length > 0) notify();
      return sending.length;
    },

    async discard(clientOrderId, reason) {
      const trimmed = reason.trim();
      if (trimmed.length < DISCARD_REASON_MIN || trimmed.length > DISCARD_REASON_MAX) {
        throw new Error(
          `El motivo debe tener entre ${DISCARD_REASON_MIN} y ${DISCARD_REASON_MAX} caracteres`,
        );
      }
      const db = await dbPromise;
      const tx = db.transaction('outbox', 'readwrite');
      const entry = await tx.store.get(clientOrderId);
      if (!entry) {
        await tx.done;
        throw new Error('El pedido ya no está en la cola');
      }
      await tx.store.delete(clientOrderId);
      await tx.done;
      notify();
      return { entry, reason: trimmed };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
