import { useMemo, useState } from 'react';
import { ChefHat, CheckCircle2, Clock, Flame, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { notifyOrderError, useAdvanceOrderStatus, useOrders } from '@/features/pos/api';
import { toBoliviaDate } from '@/features/pos/format';
import { KitchenOrderCard } from './KitchenOrderCard';

type KitchenFilterTab = 'todos' | 'pendiente' | 'en_preparacion' | 'listo';

export function KitchenPage() {
  const today = toBoliviaDate();
  const {
    data: allOrders = [],
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useOrders({ businessDate: today }, { live: true });

  const [selectedTab, setSelectedTab] = useState<KitchenFilterTab>('todos');
  const [pendingActionOrderId, setPendingActionOrderId] = useState<string | null>(null);

  const advanceMutation = useAdvanceOrderStatus();

  // Filtrar solo las órdenes activas en la cocina (excluye entregadas y anuladas)
  const activeOrders = useMemo(() => {
    return allOrders.filter(
      (o) => o.status === 'pendiente' || o.status === 'en_preparacion' || o.status === 'listo',
    );
  }, [allOrders]);

  const pendientes = useMemo(
    () => activeOrders.filter((o) => o.status === 'pendiente'),
    [activeOrders],
  );

  const enPreparacion = useMemo(
    () => activeOrders.filter((o) => o.status === 'en_preparacion'),
    [activeOrders],
  );

  const listos = useMemo(() => activeOrders.filter((o) => o.status === 'listo'), [activeOrders]);

  const handleAdvance = async (orderId: string, to: 'en_preparacion' | 'listo') => {
    const order = activeOrders.find((o) => o.id === orderId);
    setPendingActionOrderId(orderId);
    try {
      await advanceMutation.mutateAsync({
        id: orderId,
        input: { to },
      });
      const num = order ? `#${order.orderNumber}` : '';
      if (to === 'en_preparacion') {
        toast.success(`Pedido ${num} en preparación`);
      } else {
        toast.success(`Pedido ${num} listo para entrega`);
      }
    } catch (err: unknown) {
      notifyOrderError(err);
    } finally {
      setPendingActionOrderId(null);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      {/* Cabecera y controles */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <PageHeader
          eyebrow="Preparación"
          title="Cocina"
          description="Gestión de comandas y preparación de pedidos en tiempo real."
        />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isRefetching}
            className="min-h-[40px] font-heading text-xs uppercase"
          >
            <RotateCw className={`size-3.5 mr-1.5 ${isRefetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Pestañas de filtrado para pantallas pequeñas */}
      <div
        role="tablist"
        aria-label="Filtro de comandas"
        className="flex flex-wrap gap-2 lg:hidden"
      >
        <Button
          type="button"
          role="tab"
          aria-selected={selectedTab === 'todos'}
          variant={selectedTab === 'todos' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('todos')}
          className="min-h-[44px] px-4 font-heading text-xs uppercase"
        >
          Todos ({activeOrders.length})
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={selectedTab === 'pendiente'}
          variant={selectedTab === 'pendiente' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('pendiente')}
          className="min-h-[44px] px-4 font-heading text-xs uppercase"
        >
          Pendientes ({pendientes.length})
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={selectedTab === 'en_preparacion'}
          variant={selectedTab === 'en_preparacion' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('en_preparacion')}
          className="min-h-[44px] px-4 font-heading text-xs uppercase"
        >
          En preparación ({enPreparacion.length})
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={selectedTab === 'listo'}
          variant={selectedTab === 'listo' ? 'default' : 'outline'}
          onClick={() => setSelectedTab('listo')}
          className="min-h-[44px] px-4 font-heading text-xs uppercase"
        >
          Listos ({listos.length})
        </Button>
      </div>

      {/* Contenido principal: Tablero Kanban (3 columnas en desktop) */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className="h-10 animate-pulse rounded-lg bg-muted/40" />
              <div className="h-60 animate-pulse rounded-xl border bg-muted/20" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
          <p className="font-semibold">Error al cargar las comandas de cocina</p>
          <p className="text-xs">Por favor reintenta o recarga la página.</p>
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-20 text-center text-muted-foreground">
          <ChefHat className="mb-3 size-12 opacity-30" />
          <h2 className="font-heading text-lg font-bold text-foreground">
            No hay pedidos activos en cocina
          </h2>
          <p className="text-sm">
            Todo al día. Los nuevos pedidos ingresados en caja aparecerán aquí al instante.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Columna 1: Pendientes */}
          {(selectedTab === 'todos' || selectedTab === 'pendiente') && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    Pendientes
                  </h3>
                </div>
                <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 font-heading text-xs font-bold text-amber-800 dark:text-amber-300">
                  {pendientes.length}
                </span>
              </div>

              {pendientes.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                  Sin pedidos pendientes
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {pendientes.map((order) => (
                    <KitchenOrderCard
                      key={order.id}
                      order={order}
                      onAdvance={handleAdvance}
                      isPendingAction={pendingActionOrderId === order.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Columna 2: En preparación */}
          {(selectedTab === 'todos' || selectedTab === 'en_preparacion') && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Flame className="size-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                    En preparación
                  </h3>
                </div>
                <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 font-heading text-xs font-bold text-blue-800 dark:text-blue-300">
                  {enPreparacion.length}
                </span>
              </div>

              {enPreparacion.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                  Sin pedidos en preparación
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {enPreparacion.map((order) => (
                    <KitchenOrderCard
                      key={order.id}
                      order={order}
                      onAdvance={handleAdvance}
                      isPendingAction={pendingActionOrderId === order.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Columna 3: Listos para entrega */}
          {(selectedTab === 'todos' || selectedTab === 'listo') && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                    Listos para entrega
                  </h3>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-heading text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  {listos.length}
                </span>
              </div>

              {listos.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                  Sin pedidos listos
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {listos.map((order) => (
                    <KitchenOrderCard
                      key={order.id}
                      order={order}
                      onAdvance={handleAdvance}
                      isPendingAction={pendingActionOrderId === order.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
