import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  Order,
  OrderEvent,
  OrderItem,
  OrderKardexMovement,
  OrderStatus,
} from '@tus-antojos/shared';
import { createContext, useContext } from 'react';

export interface OrdersFilter {
  businessDate?: string;
  status?: OrderStatus;
  limit?: number;
  offset?: number;
}

export interface OrdersReader {
  orders(filters?: OrdersFilter): Promise<Order[]>;
  order(id: string): Promise<Order | null>;
  events(orderId: string): Promise<OrderEvent[]>;
  movements(orderId: string): Promise<OrderKardexMovement[]>;
  /** Busca un pedido por su clave de idempotencia (client_order_id). */
  orderByClientId?(clientOrderId: string): Promise<Order | null>;
  /**
   * Avisa cuando cambia cualquier pedido (Supabase Realtime). Devuelve la función
   * para cancelar la suscripción. Opcional: los lectores falsos de las pruebas no lo tienen.
   */
  subscribe?(onChange: () => void): () => void;
}

function unwrap<T>(result: { data: T | null; error: unknown }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`No se pudo cargar ${what}`, { cause: result.error });
  }
  return result.data;
}

export function toOrderItem(row: {
  line_no: number;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  promotion_id: string | null;
  promotion_name: string | null;
  unit_discount_cents: number;
  line_total_cents: number;
  note: string;
}): OrderItem {
  return {
    lineNo: row.line_no,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    promotionId: row.promotion_id,
    promotionName: row.promotion_name,
    unitDiscountCents: row.unit_discount_cents,
    lineTotalCents: row.line_total_cents,
    note: row.note ?? '',
  };
}

export function toOrder(
  row: Database['public']['Tables']['orders']['Row'] & {
    order_items?: Database['public']['Tables']['order_items']['Row'][];
    cashier?: { full_name: string } | null;
    profiles?: { full_name: string } | null;
    cashierName?: string | null;
  },
): Order {
  return {
    id: row.id,
    clientOrderId: row.client_order_id,
    businessDate: row.business_date,
    orderNumber: row.order_number,
    status: row.status,
    paymentMethod: row.payment_method,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    totalCents: row.total_cents,
    cashierId: row.cashier_id,
    cashierName:
      row.cashier?.full_name ?? row.profiles?.full_name ?? row.cashierName ?? null,
    createdOfflineAt: row.created_offline_at,
    cancelReason: row.cancel_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: Array.isArray(row.order_items) ? row.order_items.map(toOrderItem) : undefined,
  };
}

export function createSupabaseOrdersReader(db: SupabaseClient<Database>): OrdersReader {
  return {
    async orders(filters) {
      let query = db
        .from('orders')
        .select('*, order_items(*), cashier:profiles!orders_cashier_id_fkey(full_name)')
        .order('business_date', { ascending: false })
        .order('order_number', { ascending: false });

      if (filters?.businessDate) {
        query = query.eq('business_date', filters.businessDate);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.limit) {
        const from = filters.offset ?? 0;
        const to = from + filters.limit - 1;
        query = query.range(from, to);
      }

      const result = await query;
      const rows = unwrap(result, 'los pedidos');
      return (rows as unknown as Array<Parameters<typeof toOrder>[0]>).map(toOrder);
    },

    async order(id: string) {
      const result = await db
        .from('orders')
        .select('*, order_items(*), cashier:profiles!orders_cashier_id_fkey(full_name)')
        .eq('id', id)
        .maybeSingle();

      if (result.error) {
        throw new Error('No se pudo cargar el pedido', { cause: result.error });
      }
      if (!result.data) return null;
      return toOrder(result.data as unknown as Parameters<typeof toOrder>[0]);
    },

    async orderByClientId(clientOrderId: string) {
      const result = await db
        .from('orders')
        .select('*, order_items(*), cashier:profiles!orders_cashier_id_fkey(full_name)')
        .eq('client_order_id', clientOrderId)
        .maybeSingle();

      if (result.error) {
        throw new Error('No se pudo cargar el pedido', { cause: result.error });
      }
      if (!result.data) return null;
      return toOrder(result.data as unknown as Parameters<typeof toOrder>[0]);
    },

    subscribe(onChange: () => void) {
      const channel = db
        .channel(`orders-changes-${crypto.randomUUID()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => onChange())
        .subscribe();
      return () => {
        void db.removeChannel(channel);
      };
    },

    async events(orderId: string) {
      const result = await db
        .from('order_events')
        .select('*, profiles!order_events_user_id_fkey(full_name)')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      const rows = unwrap(result, 'el historial de eventos del pedido');
      return (rows as any[]).map((r) => ({
        id: Number(r.id),
        orderId: r.order_id,
        fromStatus: r.from_status,
        toStatus: r.to_status,
        reason: r.reason ?? '',
        userId: r.user_id,
        userName: r.profiles?.full_name ?? null,
        createdAt: r.created_at,
      }));
    },

    async movements(orderId: string) {
      const result = await db
        .from('inventory_movements')
        .select('*, ingredients!inventory_movements_ingredient_id_fkey(name, unit)')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      const rows = unwrap(result, 'los movimientos de inventario del pedido');
      return (rows as any[]).map((r) => ({
        id: Number(r.id),
        ingredientId: r.ingredient_id,
        ingredientName: r.ingredients?.name ?? 'Insumo',
        unit: r.ingredients?.unit ?? 'u',
        type: r.type,
        quantity: r.quantity,
        costCents: Number(r.cost_cents),
        balanceQuantity: Number(r.balance_quantity),
        balanceAvgUnitCost: String(r.balance_avg_unit_cost),
        createdAt: r.created_at,
      }));
    },
  };
}

export const OrdersReaderContext = createContext<OrdersReader | null>(null);

export function useOrdersReader(): OrdersReader {
  const reader = useContext(OrdersReaderContext);
  if (!reader) throw new Error('useOrdersReader() debe usarse dentro de <AppProviders>');
  return reader;
}
