import { z } from 'zod';

export const ORDER_STATUSES = [
  'pendiente',
  'en_preparacion',
  'listo',
  'entregado',
  'anulado',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ['efectivo', 'qr'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isIsoDatetimeNotInFuture(val: string): boolean {
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return false;
  // Margen de 1 minuto para compensar posibles desfases de reloj
  return d.getTime() <= Date.now() + 60_000;
}

export const orderLineInputSchema = z.object({
  productId: z.guid({ error: 'ID de producto inválido' }),
  quantity: z
    .number()
    .int({ error: 'La cantidad debe ser entera' })
    .min(1, { error: 'Al menos 1 unidad' })
    .max(999, { error: 'Máximo 999 unidades' }),
  note: z.string().trim().max(140, { error: 'Máximo 140 caracteres' }).default(''),
});

export type OrderLineInput = z.infer<typeof orderLineInputSchema>;

export const createOrderSchema = z.object({
  clientOrderId: z.guid({ error: 'ID de orden inválido' }),
  items: z
    .array(orderLineInputSchema, { error: 'El pedido debe incluir productos' })
    .min(1, { error: 'El pedido debe tener al menos un producto' })
    .max(50, { error: 'Máximo 50 líneas por pedido' }),
  paymentMethod: z.enum(PAYMENT_METHODS, { error: 'Método de pago inválido' }),
  createdOfflineAt: z.iso
    .datetime({ offset: true, error: 'Fecha offline inválida' })
    .refine(isIsoDatetimeNotInFuture, { error: 'La fecha offline no puede ser futura' })
    .optional(),
});

export type CreateOrderInput = z.input<typeof createOrderSchema>;
export type CreateOrder = z.output<typeof createOrderSchema>;

export const advanceOrderStatusSchema = z.strictObject({
  to: z.enum(['en_preparacion', 'listo', 'entregado'], { error: 'Estado destino inválido' }),
});

export type AdvanceOrderStatusInput = z.infer<typeof advanceOrderStatusSchema>;

export const cancelOrderSchema = z.strictObject({
  reason: z
    .string()
    .trim()
    .min(3, { error: 'Ingresa un motivo (mínimo 3 caracteres)' })
    .max(200, { error: 'Máximo 200 caracteres' }),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export interface OrderItem {
  lineNo: number;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  promotionId: string | null;
  promotionName: string | null;
  unitDiscountCents: number;
  lineTotalCents: number;
  note: string;
}

export interface Order {
  id: string;
  clientOrderId: string;
  businessDate: string;
  orderNumber: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  cashierId: string | null;
  createdOfflineAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}
