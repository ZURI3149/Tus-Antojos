import { orderRuleMessage } from '@tus-antojos/shared';
import { ApiError } from '@/lib/api-client';
import type { Outbox } from './outbox';
import type { OutboxEntry } from './types';
import type { ExclusiveLock } from './web-lock';

/** Candado compartido por todas las pestañas del origen. */
export const SYNC_LOCK_NAME = 'tus-antojos-sync';

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;

/** Espera antes del intento `attempts` (1, 2, 3…): 1 s, 2 s, 4 s… hasta 60 s. */
export function backoffDelayMs(attempts: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
}

export type SendOutcome =
  | { kind: 'transient'; error: string }
  | { kind: 'unauthorized' }
  | { kind: 'rejected'; error: string };

function rejectionMessage(error: ApiError): string {
  if (error.reason === 'STOCK_INSUFFICIENT') {
    return 'Stock insuficiente de ingredientes para este pedido';
  }
  return (error.reason && orderRuleMessage(error.reason)) || error.message;
}

/**
 * Qué hacer con un error de `POST /orders` (SPEC-offline-print OP-D5):
 * red, timeout o 5xx se reintentan; 401 espera a la sesión; el resto de 4xx va a revisión.
 */
export function classifySendError(error: unknown): SendOutcome {
  if (!(error instanceof ApiError)) {
    return {
      kind: 'transient',
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
  if (error.status === 0 || error.status >= 500) return { kind: 'transient', error: error.message };
  if (error.status === 401) return { kind: 'unauthorized' };
  return { kind: 'rejected', error: rejectionMessage(error) };
}

export interface SyncRunResult {
  sent: number;
  reviewed: number;
  /** Entradas pendientes de otro cajero que no se enviaron (OP-D8). */
  otherCashier: number;
  /** Por qué se cortó la ejecución, o `null` si recorrió toda la cola. */
  stoppedBy: 'transient' | 'unauthorized' | 'no_session' | 'offline' | 'busy' | null;
}

export interface SyncEngineOptions {
  outbox: Outbox;
  /** Envía el pedido a la API; resuelve con 201/200 y lanza el error en otro caso. */
  send: (entry: OutboxEntry) => Promise<void>;
  /** Usuario con sesión; solo se envían sus entradas. */
  getCurrentUserId: () => string | null;
  lock: ExclusiveLock;
  now?: () => Date;
  /** Si devuelve `false` no se intenta enviar (evita peticiones que fallarán seguro). */
  isOnline?: () => boolean;
}

export interface SyncEngine {
  /** Recorre la cola una vez. Si otra ejecución tiene el candado, termina con `busy`. */
  run(): Promise<SyncRunResult>;
  /**
   * Arranca la sincronización automática: al iniciar, con el evento `online` y cada `intervalMs`.
   * Devuelve la función para detenerla.
   */
  start(options?: { intervalMs?: number; target?: Window }): () => void;
}

export function createSyncEngine({
  outbox,
  send,
  getCurrentUserId,
  lock,
  now = () => new Date(),
  isOnline = () => true,
}: SyncEngineOptions): SyncEngine {
  async function drain(userId: string): Promise<SyncRunResult> {
    const result: SyncRunResult = { sent: 0, reviewed: 0, otherCashier: 0, stoppedBy: null };

    for (const entry of await outbox.list()) {
      if (entry.status !== 'pendiente') continue;
      if (entry.cashierId !== userId) {
        result.otherCashier++;
        continue;
      }
      // FIFO estricto: si la primera aún espera su reintento, las demás también esperan
      // (conserva el orden de venta para los números del día).
      if (new Date(entry.nextAttemptAt).getTime() > now().getTime()) {
        result.stoppedBy = 'transient';
        break;
      }

      await outbox.markSending(entry.clientOrderId);
      try {
        await send(entry);
        await outbox.markDone(entry.clientOrderId);
        result.sent++;
      } catch (error) {
        const outcome = classifySendError(error);
        if (outcome.kind === 'rejected') {
          await outbox.markForReview(entry.clientOrderId, outcome.error);
          result.reviewed++;
          continue;
        }
        if (outcome.kind === 'unauthorized') {
          // No cuenta como intento: se reanuda cuando la sesión se renueve.
          await outbox.retry(entry.clientOrderId, now());
          result.stoppedBy = 'unauthorized';
          break;
        }
        const nextAttemptAt = new Date(now().getTime() + backoffDelayMs(entry.attempts + 1));
        await outbox.scheduleRetry(entry.clientOrderId, { error: outcome.error, nextAttemptAt });
        result.stoppedBy = 'transient';
        break;
      }
    }
    return result;
  }

  async function run(): Promise<SyncRunResult> {
    const userId = getCurrentUserId();
    if (!userId) return { sent: 0, reviewed: 0, otherCashier: 0, stoppedBy: 'no_session' };
    if (!isOnline()) return { sent: 0, reviewed: 0, otherCashier: 0, stoppedBy: 'offline' };

    const locked = await lock(SYNC_LOCK_NAME, () => drain(userId));
    if (!locked.acquired) return { sent: 0, reviewed: 0, otherCashier: 0, stoppedBy: 'busy' };
    return locked.value;
  }

  function start({ intervalMs = 30_000, target = window } = {}) {
    let stopped = false;
    const trigger = () => {
      if (!stopped) void run();
    };

    void outbox.resetInterrupted().then(trigger);
    target.addEventListener('online', trigger);
    const timer = target.setInterval(trigger, intervalMs);

    return () => {
      stopped = true;
      target.removeEventListener('online', trigger);
      target.clearInterval(timer);
    };
  }

  return { run, start };
}
