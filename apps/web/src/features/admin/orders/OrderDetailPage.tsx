import {
  canCancel,
  formatMoney,
  formatQuantity,
  formatUnitCost,
  type IngredientUnit,
} from '@tus-antojos/shared';
import { AlertTriangle, ArrowLeft, ArrowRight, Ban, Clock, Layers, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useOrder, useOrderEvents, useOrderMovements } from '@/features/pos/api';
import { CancelOrderDialog } from '@/features/pos/CancelOrderDialog';
import { formatOrderTime, ORDER_STATUS_LABELS } from '@/features/pos/format';
import { OrderStatusBadge } from '@/features/pos/OrderStatusBadge';
import { cn } from '@/lib/utils';

const MOVEMENT_LABELS: Record<string, string> = {
  compra: 'Compra',
  venta: 'Venta',
  merma: 'Merma',
  ajuste: 'Ajuste',
  anulacion: 'Anulación',
};

function KardexTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    compra: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    venta: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    merma: 'bg-destructive/10 text-destructive border-destructive/20',
    ajuste: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    anulacion: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-heading font-medium tracking-wider uppercase border',
        styles[type] ?? 'bg-muted text-muted-foreground border-border',
      )}
    >
      {MOVEMENT_LABELS[type] ?? type}
    </span>
  );
}

export function OrderDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const orderQuery = useOrder(id);
  const eventsQuery = useOrderEvents(id);
  const movementsQuery = useOrderMovements(id);

  const order = orderQuery.data;
  const events = eventsQuery.data ?? [];
  const movements = movementsQuery.data ?? [];

  if (orderQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Cargando pedido…</p>;
  }

  if (orderQuery.isError || !order) {
    return (
      <section className="flex flex-col gap-4">
        <Link
          to="/admin/pedidos"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver a pedidos
        </Link>
        <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <span>No se pudo cargar el pedido.</span>
          <Button size="sm" variant="outline" onClick={() => orderQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      </section>
    );
  }

  const isCancellable = canCancel('admin', order);
  const isOffline = Boolean(order.createdOfflineAt);

  return (
    <section className="flex flex-col gap-8">
      {/* Navegación y cabecera */}
      <div className="flex flex-col gap-4">
        <Link
          to="/admin/pedidos"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver al historial de pedidos
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            eyebrow={`Fecha de venta: ${order.businessDate}`}
            title={`Pedido #${order.orderNumber}`}
            description={`Registrado a las ${formatOrderTime(order.createdAt)} por ${order.cashierName || 'Cajero'}.`}
          />

          <div className="flex items-center gap-3">
            <OrderStatusBadge status={order.status} />

            <span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {order.paymentMethod === 'efectivo' ? 'Efectivo' : 'QR'}
            </span>

            {isOffline && (
              <span
                title={`Registrado offline a las ${formatOrderTime(order.createdOfflineAt!)}`}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-500/20"
              >
                <WifiOff className="size-3.5" />
                Offline
              </span>
            )}

            {isCancellable && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setCancelDialogOpen(true)}
                className="gap-1.5"
              >
                <Ban className="size-4" />
                Anular pedido
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de anulación si el pedido fue anulado */}
      {order.status === 'anulado' && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-heading font-semibold uppercase tracking-wide">
              Pedido anulado
            </span>
            <p>
              <strong>Motivo:</strong> {order.cancelReason || 'Sin motivo especificado'}
            </p>
            <p className="text-xs text-destructive/80">
              Los ingredientes fueron devueltos automáticamente al stock mediante movimientos de
              anulación en el kardex.
            </p>
          </div>
        </div>
      )}

      {/* Sección 1: Líneas del pedido y desglose financiero */}
      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-bold tracking-wide">Productos del pedido</h2>

        <div
          tabIndex={0}
          role="region"
          aria-label="Productos del pedido"
          className="overflow-x-auto rounded-md border bg-card shadow-xs"
        >
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary text-left font-heading text-xs tracking-wider uppercase">
              <tr>
                <th className="px-3.5 py-3 font-semibold">#</th>
                <th className="px-3.5 py-3 font-semibold">Producto</th>
                <th className="px-3.5 py-3 font-semibold text-right">Cant.</th>
                <th className="px-3.5 py-3 font-semibold text-right">Precio unit.</th>
                <th className="px-3.5 py-3 font-semibold">Promoción</th>
                <th className="px-3.5 py-3 font-semibold text-right">Desc. unit.</th>
                <th className="px-3.5 py-3 font-semibold text-right">Total línea</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.items?.map((item) => (
                <tr key={item.lineNo} className="hover:bg-muted/40 transition-colors">
                  <td className="px-3.5 py-3 font-mono text-xs text-muted-foreground">
                    {item.lineNo}
                  </td>
                  <td className="px-3.5 py-3 font-medium">
                    <p>{item.productName}</p>
                    {item.note && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-normal italic">
                        Nota: {item.note}
                      </p>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-semibold">
                    {item.quantity}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-muted-foreground">
                    {formatMoney(item.unitPriceCents)}
                  </td>
                  <td className="px-3.5 py-3 text-xs">
                    {item.promotionName ? (
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
                        {item.promotionName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-muted-foreground">
                    {item.unitDiscountCents > 0 ? `-${formatMoney(item.unitDiscountCents)}` : '—'}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-bold">
                    {formatMoney(item.lineTotalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Resumen de totales */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs rounded-md border bg-card p-4 text-sm shadow-xs flex flex-col gap-2">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono">{formatMoney(order.subtotalCents)}</span>
            </div>
            {order.discountCents > 0 && (
              <div className="flex justify-between text-primary font-medium">
                <span>Descuento aplicado</span>
                <span className="font-mono">-{formatMoney(order.discountCents)}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-heading font-bold text-base">
              <span>Total neto</span>
              <span className="font-mono text-primary">{formatMoney(order.totalCents)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sección 2: Historial de estados (order_events) */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold tracking-wide flex items-center gap-2">
            <Clock className="size-5 text-muted-foreground" />
            Historial de cambios de estado
          </h2>
          <span className="text-xs text-muted-foreground">
            {events.length} {events.length === 1 ? 'evento registrado' : 'eventos registrados'}
          </span>
        </div>

        {eventsQuery.isPending && (
          <p className="text-sm text-muted-foreground">Cargando historial…</p>
        )}

        {!eventsQuery.isPending && events.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No se registran eventos de estado para este pedido.
          </p>
        )}

        {events.length > 0 && (
          <div
            tabIndex={0}
            role="region"
            aria-label="Historial de cambios de estado"
            className="overflow-x-auto rounded-md border bg-card shadow-xs"
          >
            <table className="w-full text-sm">
              <thead className="border-b bg-secondary text-left font-heading text-xs tracking-wider uppercase">
                <tr>
                  <th className="px-3.5 py-3 font-semibold">Hora</th>
                  <th className="px-3.5 py-3 font-semibold">Transición de estado</th>
                  <th className="px-3.5 py-3 font-semibold">Usuario</th>
                  <th className="px-3.5 py-3 font-semibold">Motivo / Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3.5 py-3 text-xs text-muted-foreground font-mono">
                      {new Date(ev.createdAt).toLocaleString('es-BO', {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        {ev.fromStatus ? (
                          <>
                            <span className="text-xs text-muted-foreground uppercase font-heading">
                              {ORDER_STATUS_LABELS[ev.fromStatus]}
                            </span>
                            <ArrowRight className="size-3.5 text-muted-foreground" />
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Creación → </span>
                        )}
                        <OrderStatusBadge status={ev.toStatus} />
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-xs text-muted-foreground">
                      {ev.userName || ev.userId || 'Sistema'}
                    </td>
                    <td className="px-3.5 py-3 text-xs">
                      {ev.reason ? (
                        <span className="font-medium text-foreground">{ev.reason}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sección 3: Movimientos de inventario (Kardex) */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold tracking-wide flex items-center gap-2">
            <Layers className="size-5 text-muted-foreground" />
            Movimientos en inventario (Kardex)
          </h2>
          <span className="text-xs text-muted-foreground">
            {movements.length}{' '}
            {movements.length === 1 ? 'movimiento asociado' : 'movimientos asociados'}
          </span>
        </div>

        {movementsQuery.isPending && (
          <p className="text-sm text-muted-foreground">Cargando movimientos de kardex…</p>
        )}

        {!movementsQuery.isPending && movements.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Este pedido no generó movimientos en el inventario.
          </p>
        )}

        {movements.length > 0 && (
          <div
            tabIndex={0}
            role="region"
            aria-label="Movimientos en inventario del pedido"
            className="overflow-x-auto rounded-md border bg-card shadow-xs"
          >
            <table className="w-full text-sm">
              <thead className="border-b bg-secondary text-left font-heading text-xs tracking-wider uppercase">
                <tr>
                  <th className="px-3.5 py-3 font-semibold">Fecha</th>
                  <th className="px-3.5 py-3 font-semibold">Insumo</th>
                  <th className="px-3.5 py-3 font-semibold">Tipo</th>
                  <th className="px-3.5 py-3 font-semibold text-right">Variación</th>
                  <th className="px-3.5 py-3 font-semibold text-right">Costo mov.</th>
                  <th className="px-3.5 py-3 font-semibold text-right">Saldo stock</th>
                  <th className="px-3.5 py-3 font-semibold text-right">Costo prom. saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((m) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3.5 py-3 text-xs text-muted-foreground font-mono">
                        {new Date(m.createdAt).toLocaleString('es-BO', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-3.5 py-3">
                        <Link
                          to={`/admin/inventario/${m.ingredientId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {m.ingredientName}
                        </Link>
                      </td>
                      <td className="px-3.5 py-3">
                        <KardexTypeBadge type={m.type} />
                      </td>
                      <td
                        className={cn(
                          'px-3.5 py-3 text-right font-mono font-medium',
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-destructive',
                        )}
                      >
                        {isPositive ? '+' : ''}
                        {formatQuantity(m.quantity, m.unit as IngredientUnit)}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono text-muted-foreground">
                        {m.costCents !== 0 ? formatMoney(m.costCents) : '—'}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono font-semibold">
                        {formatQuantity(m.balanceQuantity, m.unit as IngredientUnit)}
                      </td>
                      <td className="px-3.5 py-3 text-right font-mono text-muted-foreground">
                        {formatUnitCost(m.balanceAvgUnitCost, m.unit as IngredientUnit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Diálogo de anulación */}
      <CancelOrderDialog
        open={cancelDialogOpen}
        orderId={order.id}
        orderNumber={order.orderNumber}
        onClose={() => setCancelDialogOpen(false)}
      />
    </section>
  );
}
