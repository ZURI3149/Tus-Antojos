import type { OrderStatus } from '@tus-antojos/shared';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_LABELS } from './format';

const STATUS_VARIANTS: Record<OrderStatus, string> = {
  pendiente: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  en_preparacion: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  listo:
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-bold',
  entregado: 'bg-muted text-muted-foreground border-border',
  anulado: 'bg-destructive/15 text-destructive border-destructive/30',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-heading text-xs uppercase tracking-wider',
        STATUS_VARIANTS[status],
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
