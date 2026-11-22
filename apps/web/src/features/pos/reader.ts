import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Order, OrderItem, OrderStatus } from '@tus-antojos/shared';
import { createContext, useContext } from 'react';

export interface OrdersReader {
  orders(filters?: { businessDate?: string; status?: OrderStatus }): Promise<Order[]>;
  order(id: string): Promise<Order | null>;
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
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });

      if (filters?.businessDate) {
        query = query.eq('business_date', filters.businessDate);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const result = await query;
      const rows = unwrap(result, 'los pedidos');
      return rows.map(toOrder);
    },

    async order(id: string) {
      const result = await db
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .maybeSingle();

      if (result.error) {
        throw new Error('No se pudo cargar el pedido', { cause: result.error });
      }
      if (!result.data) return null;
      return toOrder(result.data);
    },
  };
}

export const OrdersReaderContext = createContext<OrdersReader | null>(null);

export function useOrdersReader(): OrdersReader {
  const reader = useContext(OrdersReaderContext);
  if (!reader) throw new Error('useOrdersReader() debe usarse dentro de <AppProviders>');
  return reader;
}
