import {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  formatMoney,
  type OrderStatus,
} from '@tus-antojos/shared';
import { Calendar, Eye, Filter, RefreshCw, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOrders } from '@/features/pos/api';
import { formatOrderTime, ORDER_STATUS_LABELS, toBoliviaDate } from '@/features/pos/format';
import { OrderStatusBadge } from '@/features/pos/OrderStatusBadge';
import { cn, selectClassName } from '@/lib/utils';

export function OrdersPage() {
  const [businessDate, setBusinessDate] = useState<string>(toBoliviaDate());
  const [status, setStatus] = useState<string>('todos');
  const [paymentMethod, setPaymentMethod] = useState<string>('todos');
  const [limit, setLimit] = useState(50);

  const queryFilters = {
    businessDate: businessDate ? businessDate : undefined,
    status: status !== 'todos' ? (status as OrderStatus) : undefined,
    limit,
  };

  const { data: orders = [], isPending, isError, refetch } = useOrders(queryFilters);

  // Filtro local adicional de método de pago si aplica
  const filteredOrders = orders.filter((o) => {
    if (paymentMethod !== 'todos' && o.paymentMethod !== paymentMethod) {
      return false;
    }
    return true;
  });

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Panel"
        title="Historial de pedidos"
        description="Listado de ventas, estado de las comandas y auditoría de inventario."
      />

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4 shadow-xs">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-date" className="text-xs font-heading font-medium tracking-wide">
            Fecha de venta
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="filter-date"
              type="date"
              value={businessDate}
              onChange={(e) => setBusinessDate(e.target.value)}
              className="w-40 h-9 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBusinessDate(toBoliviaDate())}
              className="h-9 px-2.5 text-xs"
            >
              <Calendar className="mr-1.5 size-3.5" />
              Hoy
            </Button>
            {businessDate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBusinessDate('')}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Todas
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 min-w-36">
          <label htmlFor="filter-status" className="text-xs font-heading font-medium tracking-wide">
            Estado
          </label>
          <select
            id="filter-status"
            aria-label="Estado"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(selectClassName, 'h-9 text-xs')}
          >
            <option value="todos">Todos los estados</option>
            {ORDER_STATUSES.map((st) => (
              <option key={st} value={st}>
                {ORDER_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 min-w-36">
          <label
            htmlFor="filter-payment"
            className="text-xs font-heading font-medium tracking-wide"
          >
            Método de pago
          </label>
          <select
            id="filter-payment"
            aria-label="Método de pago"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className={cn(selectClassName, 'h-9 text-xs')}
          >
            <option value="todos">Todos</option>
            {PAYMENT_METHODS.map((pm) => (
              <option key={pm} value={pm}>
                {pm === 'efectivo' ? 'Efectivo' : 'QR'}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-9 text-xs gap-1.5"
            aria-label="Actualizar pedidos"
          >
            <RefreshCw className="size-3.5" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Estados de carga y error */}
      {isPending && <p className="text-sm text-muted-foreground">Cargando pedidos…</p>}

      {isError && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <span>No se pudo cargar el historial de pedidos.</span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Tabla de pedidos */}
      {!isPending && !isError && (
        <div className="flex flex-col gap-4">
          <div
            tabIndex={0}
            role="region"
            aria-label="Listado de pedidos"
            className="overflow-x-auto rounded-md border bg-card shadow-xs"
          >
            <table className="w-full text-sm">
              <thead className="border-b bg-secondary text-left font-heading text-xs tracking-wider uppercase">
                <tr>
                  <th className="px-3.5 py-3 font-semibold">Número</th>
                  <th className="px-3.5 py-3 font-semibold">Hora</th>
                  <th className="px-3.5 py-3 font-semibold text-right">Total</th>
                  <th className="px-3.5 py-3 font-semibold">Método</th>
                  <th className="px-3.5 py-3 font-semibold">Estado</th>
                  <th className="px-3.5 py-3 font-semibold">Cajero</th>
                  <th className="px-3.5 py-3 font-semibold text-center">Offline</th>
                  <th className="px-3.5 py-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">
                      <Filter className="mx-auto mb-2 size-6 opacity-40" />
                      No se encontraron pedidos con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const isOffline = Boolean(order.createdOfflineAt);
                    return (
                      <tr key={order.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-3.5 py-3 font-mono font-bold text-foreground">
                          #{order.orderNumber}
                        </td>
                        <td className="px-3.5 py-3 text-xs text-muted-foreground font-mono">
                          {formatOrderTime(order.createdAt)}
                        </td>
                        <td className="px-3.5 py-3 text-right font-mono font-semibold">
                          {formatMoney(order.totalCents)}
                        </td>
                        <td className="px-3.5 py-3">
                          <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {order.paymentMethod === 'efectivo' ? 'Efectivo' : 'QR'}
                          </span>
                        </td>
                        <td className="px-3.5 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-3.5 py-3 text-xs text-muted-foreground">
                          {order.cashierName || '—'}
                        </td>
                        <td className="px-3.5 py-3 text-center">
                          {isOffline ? (
                            <span
                              title={`Registrado offline a las ${formatOrderTime(order.createdOfflineAt!)}`}
                              className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.7rem] font-medium text-amber-700 dark:text-amber-400 border border-amber-500/20"
                            >
                              <WifiOff className="size-3" />
                              Offline
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                            <Link to={`/admin/pedidos/${order.id}`}>
                              <Eye className="size-3.5" />
                              Ver detalle
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {orders.length >= limit && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setLimit((prev) => prev + 50)}
                className="gap-2 text-xs"
              >
                Cargar más pedidos
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
