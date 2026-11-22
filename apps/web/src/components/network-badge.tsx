import { CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { useOutbox } from '@/app/outbox-context';
import { useNetworkStatus } from '@/lib/offline/use-network-status';
import { cn } from '@/lib/utils';

export interface NetworkBadgeViewProps {
  online: boolean;
  /** Pedidos del usuario que faltan enviar. */
  pending: number;
}

function pendingText(n: number): string {
  return n === 1 ? '1 pedido' : `${n} pedidos`;
}

/** Estado de la red y de la cola: "En línea", "Sin conexión" o "Sincronizando N" (OP3). */
export function NetworkBadgeView({ online, pending }: NetworkBadgeViewProps) {
  const label = !online
    ? pending > 0
      ? `Modo sin conexión · ${pendingText(pending)} sin enviar`
      : 'Modo sin conexión'
    : pending > 0
      ? `Sincronizando ${pendingText(pending)}`
      : 'En línea';
  const Icon = !online ? CloudOff : pending > 0 ? RefreshCw : Wifi;

  return (
    <span
      role="status"
      aria-live="polite"
      data-state={!online ? 'offline' : pending > 0 ? 'syncing' : 'online'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 font-heading text-[0.7rem] font-medium tracking-wider uppercase',
        !online
          ? 'bg-amber-400 text-amber-950'
          : pending > 0
            ? 'bg-white/20 text-primary-foreground'
            : 'text-primary-foreground/80',
      )}
    >
      <Icon aria-hidden className={cn('size-3.5', online && pending > 0 && 'animate-spin')} />
      {label}
    </span>
  );
}

/** Indicador conectado a la red del navegador y a la cola offline. */
export function NetworkBadge() {
  const online = useNetworkStatus();
  const { pendingCount } = useOutbox();
  return <NetworkBadgeView online={online} pending={pendingCount} />;
}
