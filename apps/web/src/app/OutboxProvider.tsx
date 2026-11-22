import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { createOrder } from '@/features/pos/api';
import { useApi } from '@/lib/api-context';
import type { Outbox } from '@/lib/offline/outbox';
import { createSyncEngine } from '@/lib/offline/sync';
import type { OutboxEntry } from '@/lib/offline/types';
import { createWebLock } from '@/lib/offline/web-lock';
import { OutboxContext, type OutboxState } from './outbox-context';

/**
 * Mantiene la cola offline a la vista de la UI y arranca la sincronización mientras haya
 * una sesión (SPEC-offline-print OP-D5). Va dentro de `AuthProvider` y de `ApiContext`.
 */
export function OutboxProvider({ outbox, children }: { outbox: Outbox; children: ReactNode }) {
  const api = useApi();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [entries, setEntries] = useState<OutboxEntry[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      void outbox.list().then((list) => {
        if (alive) setEntries(list);
      });
    };
    load();
    const unsubscribe = outbox.subscribe(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [outbox]);

  // Un motor por usuario: al cambiar la sesión se detiene el anterior y arranca otro (OP-D8).
  const engine = useMemo(
    () =>
      createSyncEngine({
        outbox,
        send: async (entry) => {
          await createOrder(api, entry.body);
        },
        getCurrentUserId: () => userId,
        lock: createWebLock(),
      }),
    [outbox, api, userId],
  );

  useEffect(() => {
    if (!userId) return;
    return engine.start();
  }, [engine, userId]);

  const value = useMemo<OutboxState>(
    () => ({
      outbox,
      entries,
      pendingCount: entries.filter((e) => e.status !== 'por_revisar' && e.cashierId === userId)
        .length,
      syncNow: () => engine.run(),
    }),
    [outbox, entries, userId, engine],
  );

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}
