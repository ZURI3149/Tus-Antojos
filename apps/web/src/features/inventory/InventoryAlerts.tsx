import { formatQuantity } from '@tus-antojos/shared';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';
import { useStock } from './api';
import { StockStatusBadge } from './StockStatusBadge';

export function InventoryAlerts() {
  const stockQuery = useStock();
  const items = stockQuery.data ?? [];

  const alerts = items.filter((item) => item.status !== 'normal');

  if (stockQuery.isPending) {
    return (
      <div className="rounded-lg border bg-card p-4 text-xs text-muted-foreground animate-pulse">
        Comprobando alertas de inventario…
      </div>
    );
  }

  if (stockQuery.isError) {
    return null;
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">
              Inventario en niveles óptimos
            </p>
            <p className="text-xs text-muted-foreground">
              Ningún insumo se encuentra por debajo de su stock mínimo ni en negativo.
            </p>
          </div>
        </div>
        <Link
          to="/admin/inventario"
          className="inline-flex items-center gap-1 font-heading text-xs font-medium tracking-wider text-primary uppercase hover:underline"
        >
          Ver stock
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center justify-between gap-4 border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4" />
          </span>
          <div>
            <h3 className="font-heading text-sm font-bold text-amber-900 dark:text-amber-300">
              Alertas de inventario ({alerts.length})
            </h3>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
              Insumos con existencias bajas o agotadas que requieren reposición.
            </p>
          </div>
        </div>
        <Link
          to="/admin/inventario?alertas=true"
          className="inline-flex items-center gap-1 font-heading text-xs font-semibold tracking-wider text-amber-900 dark:text-amber-300 uppercase hover:underline"
        >
          Ver todas
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-1">
        {alerts.slice(0, 6).map((item) => (
          <Link
            key={item.ingredientId}
            to={`/admin/inventario/${item.ingredientId}`}
            className="flex items-center justify-between rounded-md border border-amber-500/20 bg-card p-2.5 text-xs hover:border-amber-500/40 transition-colors"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-foreground truncate max-w-[150px]">
                {item.ingredientName}
              </span>
              <span className="text-muted-foreground font-mono">
                Stock: {formatQuantity(item.quantity, item.unit)} (mín.{' '}
                {formatQuantity(item.minQuantity, item.unit)})
              </span>
            </div>
            <StockStatusBadge status={item.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
