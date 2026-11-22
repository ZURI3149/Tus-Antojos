import type { CreateOrderInput, PricedCartLine } from '@tus-antojos/shared';

/**
 * Versión del formato de la cola (SPEC-offline-print OP-D4). Es también la versión de la base
 * IndexedDB: cambiarla exige una migración en `db.ts` y aprobación (SPEC.md §9).
 */
export const OUTBOX_SCHEMA_VERSION = 1;

export type OutboxStatus = 'pendiente' | 'enviando' | 'por_revisar';

/** Copia de lo que vio y cobró el cajero, para el ticket y para comparar con la API. */
export interface ChargedSnapshot {
  lines: PricedCartLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  /** Solo efectivo. */
  cashReceivedCents: number | null;
  changeCents: number | null;
}

/** Pedido cobrado que todavía no llegó a la API. La clave es `clientOrderId`. */
export interface OutboxEntry {
  schemaVersion: number;
  clientOrderId: string;
  /** Cuerpo exacto de `POST /orders`; se reenvía tal cual (idempotencia). */
  body: CreateOrderInput;
  cashierId: string;
  cashierName: string;
  charged: ChargedSnapshot;
  /** ISO 8601 (UTC). */
  enqueuedAt: string;
  attempts: number;
  /** ISO 8601 (UTC): antes de esta hora no se reintenta. */
  nextAttemptAt: string;
  status: OutboxStatus;
  lastError: string | null;
}

/** Lo que entrega la caja al encolar; la cola completa el resto. */
export type NewOutboxEntry = Pick<OutboxEntry, 'body' | 'cashierId' | 'cashierName' | 'charged'>;

/** Última lectura guardada de una consulta (catálogo, promociones) para usarla sin red. */
export interface Snapshot<T = unknown> {
  key: string;
  savedAt: string;
  data: T;
}
