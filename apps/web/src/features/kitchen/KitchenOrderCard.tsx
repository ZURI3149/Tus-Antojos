import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  MessageSquare,
  Play,
} from 'lucide-react';
import type { Order } from '@tus-antojos/shared';
import { Button } from '@/components/ui/button';
import { formatOrderTime } from '@/features/pos/format';
import { OrderStatusBadge } from '@/features/pos/OrderStatusBadge';

export interface KitchenOrderCardProps {
  order: Order;
  onAdvance: (orderId: string, to: 'en_preparacion' | 'listo') => void;
  isPendingAction?: boolean;
}

export function formatElapsed(createdAt: string): { label: string; isDelayed: boolean } {
  const created = new Date(createdAt).getTime();
  const diffMinutes = Math.floor((Date.now() - created) / 60_000);
  if (Number.isNaN(diffMinutes) || diffMinutes < 1) {
    return { label: 'Ahora mismo', isDelayed: false };
  }
  return {
    label: `Hace ${diffMinutes} min`,
    isDelayed: diffMinutes >= 15,
  };
}

export function KitchenOrderCard({
  order,
  onAdvance,
  isPendingAction = false,
}: KitchenOrderCardProps) {
  const elapsed = formatElapsed(order.createdAt);
  const isPending = order.status === 'pendiente';
  const isInPrep = order.status === 'en_preparacion';
  const isReady = order.status === 'listo';

  return (
    <div
      data-testid={`kitchen-order-${order.orderNumber}`}
      className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-sm transition-all ${
        isPending
          ? 'border-amber-500/40 bg-amber-500/5'
          : isInPrep
            ? 'border-blue-500/40 bg-blue-500/5 ring-1 ring-blue-500/20'
            : isReady
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-border'
      }`}
    >
      <div className="flex flex-col gap-3">
        {/* Cabecera de la comanda */}
        <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-heading text-2xl font-black tracking-wide text-foreground">
                #{order.orderNumber}
              </span>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {formatOrderTime(order.createdAt)}
              </span>
              <span>•</span>
              <span
                className={`font-semibold ${
                  elapsed.isDelayed
                    ? 'flex items-center gap-1 text-destructive font-bold'
                    : 'text-muted-foreground'
                }`}
              >
                {elapsed.isDelayed && <AlertCircle className="size-3" />}
                {elapsed.label}
              </span>
            </div>
          </div>
        </div>

        {/* Lista de productos para preparar */}
        <div className="flex flex-col gap-2.5 py-1">
          {(order.items ?? []).map((item) => (
            <div
              key={item.lineNo}
              className="flex flex-col rounded-lg border border-border/50 bg-background/60 p-2.5 shadow-2xs"
            >
              <div className="flex items-baseline gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 font-heading text-sm font-black text-primary">
                  {item.quantity}x
                </span>
                <span className="font-heading text-base font-bold text-foreground">
                  {item.productName}
                </span>
              </div>

              {/* Nota de cocina destacada */}
              {item.note && (
                <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-900 dark:text-amber-200">
                  <MessageSquare className="size-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span className="font-medium italic">Nota: &ldquo;{item.note}&rdquo;</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Botones de acción de la cocina */}
      <div className="mt-4 pt-3 border-t border-border/60">
        {isPending && (
          <Button
            type="button"
            variant="default"
            size="lg"
            onClick={() => onAdvance(order.id, 'en_preparacion')}
            disabled={isPendingAction}
            className="w-full min-h-[48px] bg-blue-600 hover:bg-blue-700 font-heading text-sm font-bold tracking-wide uppercase shadow-sm"
          >
            {isPendingAction ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Flame className="mr-2 size-4" />
            )}
            Empezar preparación
          </Button>
        )}

        {isInPrep && (
          <Button
            type="button"
            variant="default"
            size="lg"
            onClick={() => onAdvance(order.id, 'listo')}
            disabled={isPendingAction}
            className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 font-heading text-sm font-bold tracking-wide uppercase shadow-sm"
          >
            {isPendingAction ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 size-4" />
            )}
            Listo para entrega
          </Button>
        )}

        {isReady && (
          <div className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
            Listo · Esperando entrega en caja
          </div>
        )}
      </div>
    </div>
  );
}
