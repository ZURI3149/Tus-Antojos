import { createContext, useContext } from 'react';
import type { Outbox } from '@/lib/offline/outbox';
import type { SyncRunResult } from '@/lib/offline/sync';
import type { OutboxEntry } from '@/lib/offline/types';

export interface OutboxState {
  outbox: Outbox;
  /** Toda la cola en orden FIFO (de todos los cajeros de este dispositivo). */
  entries: OutboxEntry[];
  /** Pedidos del usuario actual que faltan enviar (sin contar los "por revisar"). */
  pendingCount: number;
  /** Sincroniza ya, sin esperar el próximo disparo. */
  syncNow: () => Promise<SyncRunResult>;
}

export const OutboxContext = createContext<OutboxState | null>(null);

export function useOutbox(): OutboxState {
  const state = useContext(OutboxContext);
  if (!state) throw new Error('useOutbox() debe usarse dentro de <AppProviders>');
  return state;
}
