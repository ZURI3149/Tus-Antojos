import { useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Printer,
  Clock,
  QrCode,
  Search,
  ShoppingBag,
  Tag,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  canCancel,
  canTransition,
  formatMoney,
  type Order,
  type OrderStatus,
} from '@tus-antojos/shared';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProfile } from '@/features/auth/use-profile';
import { notifyOrderError, useAdvanceOrderStatus, useOrders } from './api';
import { CancelOrderDialog } from './CancelOrderDialog';
import { formatOrderTime, toBoliviaDate } from './format';
import { OrderStatusBadge } from './OrderStatusBadge';
import { OutboxPanel } from './OutboxPanel';
import { usePrintTicket } from './use-print-ticket';
import { ticketFromOrder } from '@/lib/escpos/ticket';
import { PosNav } from './PosNav';

type FilterTab = 'todos' | OrderStatus;

export function CashierOrdersPage() {
  const today = toBoliviaDate();
  const {
    data: orders = [],
    isLoading,
    error,
  } = useOrders({ businessDate: today }, { live: true });
  const { data: profile } = useProfile();

  const [selectedTab, setSelectedTab] = useState<FilterTab>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  const advanceStatusMutation = useAdvanceOrderStatus();
  const { printTicket } = usePrintTicket();

  const counts = useMemo(() => {
    const res: Record<FilterTab, number> = {
      todos: orders.length,
      pendiente: 0,
      en_preparacion: 0,
      listo: 0,
      entregado: 0,
      anulado: 0,
    };
    for (const o of orders) {
      if (res[o.status] !== undefined) {
        res[o.status]++;
      }
    }
    return res;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (selectedTab !== 'todos' && o.status !== selectedTab) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = `#${o.orderNumber}`.includes(q) || String(o.orderNumber) === q;
        const matchesItem = (o.items ?? []).some((item) =>
          item.productName.toLowerCase().includes(q),
        );
        return matchesNum || matchesItem;
      })
      .sort((a, b) => {
        // Mostrar primero los pedidos en estado 'listo' (requieren entrega rápida)
        if (a.status === 'listo' && b.status !== 'listo') return -1;
        if (b.status === 'listo' && a.status !== 'listo') return 1;
        return b.orderNumber - a.orderNumber;
      });
  }, [orders, selectedTab, searchQuery]);

  const handleDeliver = async (order: Order) => {
    try {
      await advanceStatusMutation.mutateAsync({
        id: order.id,
        input: { to: 'entregado' },
      });
      toast.success(`Pedido #${order.orderNumber} entregado con éxito`);
    } catch (err: unknown) {
      notifyOrderError(err);
    }
  };

  const userRole = profile?.role ?? 'cajero';
  const userId = profile?.id;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader
          eyebrow="Punto de venta"
          title="Pedidos del día"
          description="Consulta el estado de las órdenes de hoy, marca pedidos entregados o anula ventas si es necesario."
        />
        <PosNav />
      </div>

      <OutboxPanel />

      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por # de pedido o producto..."
            aria-label="Buscar pedidos"
            className="pl-9 pr-9 min-h-[44px]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Pestañas de estado con contador */}
        <div
          role="tablist"
          aria-label="Filtro por estado de pedido"
          className="flex flex-wrap gap-2 pb-1"
        >
          <Button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'todos'}
            variant={selectedTab === 'todos' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('todos')}
            className="min-h-[40px] px-3 font-heading text-xs uppercase"
          >
            Todos ({counts.todos})
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'listo'}
            variant={selectedTab === 'listo' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('listo')}
            className="min-h-[40px] px-3 font-heading text-xs uppercase"
          >
            Listos ({counts.listo})
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'en_preparacion'}
            variant={selectedTab === 'en_preparacion' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('en_preparacion')}
            className="min-h-[40px] px-3 font-heading text-xs uppercase"
          >
            En preparación ({counts.en_preparacion})
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'pendiente'}
            variant={selectedTab === 'pendiente' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('pendiente')}
            className="min-h-[40px] px-3 font-heading text-xs uppercase"
          >
            Pendientes ({counts.pendiente})
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'entregado'}
            variant={selectedTab === 'entregado' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('entregado')}
            className="min-h-[40px] px-3 font-heading text-xs uppercase"
          >
            Entregados ({counts.entregado})
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={selectedTab === 'anulado'}
            variant={selectedTab === 'anulado' ? 'default' : 'outline'}
            onClick={() => setSelectedTab('anulado')}
            className="min-h-[40px] px-3 font-heading text-xs uppercase"
          >
            Anulados ({counts.anulado})
          </Button>
        </div>
      </div>

      {/* Lista de pedidos */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border bg-muted/30 p-4" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
          <p className="font-semibold">Error al cargar los pedidos del día</p>
          <p className="text-xs">Por favor recarga la página o inténtalo de nuevo.</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          <ShoppingBag className="mb-2 size-8 opacity-30" />
          <p className="text-base font-semibold">No se encontraron pedidos</p>
          <p className="text-xs">
            {orders.length === 0
              ? 'No hay pedidos registrados en la jornada de hoy.'
              : 'No hay pedidos que coincidan con el filtro seleccionado.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredOrders.map((order) => {
            const isReady = order.status === 'listo';
            const canDeliver = canTransition(userRole, order.status, 'entregado');
            const userCanCancel = canCancel(userRole, order, userId, today);

            return (
              <div
                key={order.id}
                className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-2xs transition-all ${
                  isReady ? 'border-emerald-500/50 ring-1 ring-emerald-500/30' : ''
                }`}
              >
                {/* Cabecera de la tarjeta */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2 border-b pb-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-heading text-lg font-extrabold text-foreground">
                          Pedido #{order.orderNumber}
                        </span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatOrderTime(order.createdAt)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {order.paymentMethod === 'efectivo' ? (
                            <>
                              <Banknote className="size-3" />
                              Efectivo
                            </>
                          ) : (
                            <>
                              <QrCode className="size-3" />
                              Pago QR
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-heading text-base font-extrabold tabular-nums text-foreground">
                        {formatMoney(order.totalCents)}
                      </span>
                      {order.discountCents > 0 && (
                        <p className="text-[0.65rem] text-emerald-600 dark:text-emerald-400">
                          Desc. -{formatMoney(order.discountCents)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Detalle de ítems */}
                  <div className="flex flex-col gap-1.5 py-1 text-sm">
                    {(order.items ?? []).map((item) => (
                      <div key={item.lineNo} className="flex flex-col text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {item.quantity}x {item.productName}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {formatMoney(item.lineTotalCents)}
                          </span>
                        </div>
                        {item.note && (
                          <span className="text-[0.7rem] italic text-muted-foreground">
                            Nota: {item.note}
                          </span>
                        )}
                        {item.promotionName && (
                          <span className="inline-flex items-center gap-0.5 text-[0.65rem] text-emerald-600 dark:text-emerald-400">
                            <Tag className="size-2.5" />
                            {item.promotionName} (-{formatMoney(item.unitDiscountCents)})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Motivo de anulación si aplica */}
                  {order.status === 'anulado' && order.cancelReason && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                      <span className="font-semibold">Motivo:</span> {order.cancelReason}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Reimprimir pedido #${order.orderNumber}`}
                    onClick={() => void printTicket(ticketFromOrder(order, { reprint: true }))}
                    className="min-h-[44px] font-heading text-xs"
                  >
                    <Printer aria-hidden className="size-3.5 mr-1" />
                    Reimprimir
                  </Button>
                  {canDeliver && isReady && (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => handleDeliver(order)}
                      disabled={advanceStatusMutation.isPending}
                      className="min-h-[44px] flex-1 bg-emerald-600 font-heading text-xs font-bold text-white hover:bg-emerald-700 uppercase tracking-wide"
                    >
                      <CheckCircle2 className="size-4 mr-1.5" />
                      Marcar como entregado
                    </Button>
                  )}

                  {userCanCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCancellingOrder(order)}
                      className="min-h-[44px] text-xs font-heading text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <XCircle className="size-3.5 mr-1" />
                      Anular pedido
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Diálogo de confirmación para anulación */}
      {cancellingOrder && (
        <CancelOrderDialog
          open={Boolean(cancellingOrder)}
          orderNumber={cancellingOrder.orderNumber}
          orderId={cancellingOrder.id}
          onClose={() => setCancellingOrder(null)}
        />
      )}
    </section>
  );
}
