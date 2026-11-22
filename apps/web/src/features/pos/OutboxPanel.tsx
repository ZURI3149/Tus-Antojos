import { useMemo, useState } from 'react';
import { AlertTriangle, CloudUpload, Loader2, RotateCw, Trash2 } from 'lucide-react';
import { formatMoney } from '@tus-antojos/shared';
import { useOutbox } from '@/app/outbox-context';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import type { OutboxEntry } from '@/lib/offline/types';
import { provisionalOrderLabel, useNetworkStatus } from '@/lib/offline/use-network-status';
import { DiscardOutboxDialog } from './DiscardOutboxDialog';
import { formatOrderTime } from './format';

function attemptsText(n: number): string {
  return n === 1 ? '1 intento fallido' : `${n} intentos fallidos`;
}

function pendingText(n: number): string {
  return n === 1 ? '1 pedido' : `${n} pedidos`;
}

function EntryStatus({ entry }: { entry: OutboxEntry }) {
  if (entry.status === 'enviando') {
    return <span className="text-xs text-muted-foreground">Enviando…</span>;
  }
  if (entry.status === 'por_revisar') {
    return (
      <span className="text-xs font-medium text-destructive">
        Por revisar: {entry.lastError ?? 'error desconocido'}
      </span>
    );
  }
  if (entry.attempts === 0) {
    return <span className="text-xs text-muted-foreground">Pendiente de envío</span>;
  }
  return (
    <span className="text-xs text-muted-foreground">
      {attemptsText(entry.attempts)} · próximo a las {formatOrderTime(entry.nextAttemptAt)}
      {entry.lastError ? ` · ${entry.lastError}` : ''}
    </span>
  );
}

/**
 * Pedidos cobrados que todavía no llegaron a la API (SPEC-offline-print OP4, OP-D7, OP-D8).
 * Solo se ve si hay algo en la cola.
 */
export function OutboxPanel() {
  const { outbox, entries, syncNow } = useOutbox();
  const { session } = useAuth();
  const online = useNetworkStatus();
  const userId = session?.user.id;
  const [discarding, setDiscarding] = useState<OutboxEntry | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const own = useMemo(() => entries.filter((e) => e.cashierId === userId), [entries, userId]);
  const othersByCashier = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      if (e.cashierId === userId) continue;
      const name = e.cashierName || 'otro usuario';
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()];
  }, [entries, userId]);

  if (entries.length === 0) return null;

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await syncNow();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetry = async (entry: OutboxEntry) => {
    await outbox.retry(entry.clientOrderId);
    await syncNow();
  };

  return (
    <section
      aria-labelledby="outbox-panel-title"
      className="flex flex-col gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CloudUpload aria-hidden className="size-5 text-amber-600 dark:text-amber-400" />
          <h2 id="outbox-panel-title" className="font-heading text-sm font-semibold uppercase">
            <span className="sr-only">Pedidos sin sincronizar</span>
            <span aria-hidden>Sin sincronizar ({own.length})</span>
          </h2>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleSyncNow()}
          disabled={!online || isSyncing || own.length === 0}
          className="min-h-[44px] font-heading text-xs uppercase"
        >
          {isSyncing ? (
            <Loader2 aria-hidden className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <RotateCw aria-hidden className="mr-1.5 size-3.5" />
          )}
          Sincronizar ahora
        </Button>
      </div>

      {!online && (
        <p className="text-xs text-muted-foreground">
          Sin conexión: los pedidos se enviarán solos al volver la red.
        </p>
      )}

      {own.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {own.map((entry) => {
            const label = provisionalOrderLabel(entry.clientOrderId);
            return (
              <li key={entry.clientOrderId} className="flex flex-wrap items-center gap-3 p-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-heading text-sm font-bold">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatOrderTime(entry.body.createdOfflineAt ?? entry.enqueuedAt)}
                    </span>
                    <span className="font-heading text-sm font-semibold tabular-nums">
                      {formatMoney(entry.charged.totalCents)}
                    </span>
                  </div>
                  <EntryStatus entry={entry} />
                </div>
                {entry.status === 'por_revisar' && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Reintentar ${label}`}
                      onClick={() => void handleRetry(entry)}
                      disabled={!online}
                      className="min-h-[44px] font-heading text-xs uppercase"
                    >
                      <RotateCw aria-hidden className="mr-1.5 size-3.5" />
                      Reintentar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Descartar ${label}`}
                      onClick={() => setDiscarding(entry)}
                      className="min-h-[44px] font-heading text-xs uppercase text-destructive"
                    >
                      <Trash2 aria-hidden className="mr-1.5 size-3.5" />
                      Descartar
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {othersByCashier.map(([name, count]) => (
        <p key={name} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Hay {pendingText(count)} de {name} sin sincronizar. Se enviarán cuando esa persona inicie
          sesión en esta caja.
        </p>
      ))}

      <DiscardOutboxDialog entry={discarding} onClose={() => setDiscarding(null)} />
    </section>
  );
}
