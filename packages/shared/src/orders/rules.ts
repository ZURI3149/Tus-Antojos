import type { AppRole } from '../roles';
import type { OrderStatus } from './orders.schema';

export const ORDER_RULES = [
  'ORDER_NOT_FOUND',
  'PRODUCT_NOT_FOUND',
  'PRODUCT_INACTIVE',
  'IDEMPOTENCY_KEY_REUSED',
  'INVALID_STATUS_TRANSITION',
  'ORDER_NOT_CANCELLABLE',
  'ORDER_CANCEL_FORBIDDEN',
  'ORDER_TOO_LARGE',
] as const;

export type OrderRule = (typeof ORDER_RULES)[number];

export const ORDER_RULE_MESSAGES: Record<OrderRule, string> = {
  ORDER_NOT_FOUND: 'El pedido no existe',
  PRODUCT_NOT_FOUND: 'El producto no existe',
  PRODUCT_INACTIVE: 'El producto no está activo para la venta',
  IDEMPOTENCY_KEY_REUSED: 'La clave de idempotencia ya fue usada con otro contenido',
  INVALID_STATUS_TRANSITION: 'Transición de estado no permitida',
  ORDER_NOT_CANCELLABLE: 'El pedido no se puede anular en su estado actual',
  ORDER_CANCEL_FORBIDDEN: 'No tienes permiso para anular este pedido',
  ORDER_TOO_LARGE: 'La cantidad supera el límite permitido',
};

export function orderRuleMessage(code: string): string | undefined {
  return (ORDER_RULE_MESSAGES as Record<string, string>)[code];
}

/**
 * Transiciones de estado permitidas por rol (SPEC-orders.md §2 D7):
 * - pendiente → en_preparacion: cocina, admin
 * - en_preparacion → listo: cocina, admin
 * - listo → entregado: cajero, admin
 * - mismo estado → permitido (idempotente para reintentos)
 */
export function canTransition(role: AppRole, from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  if (role === 'admin') {
    if (from === 'pendiente' && to === 'en_preparacion') return true;
    if (from === 'en_preparacion' && to === 'listo') return true;
    if (from === 'listo' && to === 'entregado') return true;
    return false;
  }
  if (role === 'cocina') {
    if (from === 'pendiente' && to === 'en_preparacion') return true;
    if (from === 'en_preparacion' && to === 'listo') return true;
    return false;
  }
  if (role === 'cajero') {
    if (from === 'listo' && to === 'entregado') return true;
    return false;
  }
  return false;
}

/**
 * Reglas de anulación de pedidos (SPEC-orders.md §2 D8):
 * - Solo desde 'pendiente' o 'en_preparacion'
 * - admin: anula cualquiera en esos estados
 * - cajero: solo si fue creado por él mismo hoy
 */
export function canCancel(
  role: AppRole,
  order: { status: OrderStatus; cashierId?: string | null; businessDate?: string },
  userId?: string,
  todayDate?: string,
): boolean {
  if (order.status !== 'pendiente' && order.status !== 'en_preparacion') {
    return false;
  }
  if (role === 'admin') {
    return true;
  }
  if (role === 'cajero') {
    if (!userId || !order.cashierId || order.cashierId !== userId) {
      return false;
    }
    if (todayDate && order.businessDate && order.businessDate !== todayDate) {
      return false;
    }
    return true;
  }
  return false;
}
