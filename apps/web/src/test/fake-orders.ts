import {
  canCancel,
  canTransition,
  priceCart,
  type AdvanceOrderStatusInput,
  type CancelOrderInput,
  type CreateOrderInput,
  type Order,
  type OrderEvent,
  type OrderItem,
  type OrderKardexMovement,
} from '@tus-antojos/shared';
import { toBoliviaDate } from '@/features/pos/format';
import type { OrdersFilter, OrdersReader } from '@/features/pos/reader';
import { ApiError } from '@/lib/api-client';
import { TEST_USERS } from './fake-auth';
import { NOT_HANDLED, type FakeCatalog } from './fake-catalog';
import type { FakePromotions } from './fake-promotions';

export interface FakeOrders {
  data: Order[];
  events: OrderEvent[];
  movements: (OrderKardexMovement & { orderId: string })[];
  reader: OrdersReader;
  handle(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): unknown;
}

export function seedOrders(catalog: FakeCatalog): Order[] {
  const p1 = catalog.data.products[0];
  const today = toBoliviaDate();
  const now = new Date().toISOString();

  const item1: OrderItem = {
    lineNo: 1,
    productId: p1?.id ?? '00000000-0000-4000-8000-0000000000f1',
    productName: p1?.name ?? 'Cono simple',
    quantity: 2,
    unitPriceCents: 1000,
    promotionId: null,
    promotionName: null,
    unitDiscountCents: 0,
    lineTotalCents: 2000,
    note: '',
  };

  const item2: OrderItem = {
    ...item1,
    quantity: 1,
    lineTotalCents: 1000,
    note: 'Sin azúcar',
  };

  return [
    {
      id: '00000000-0000-4000-8000-0000000000o1',
      clientOrderId: '00000000-0000-4000-8000-0000000000c1',
      businessDate: today,
      orderNumber: 1,
      status: 'listo',
      paymentMethod: 'efectivo',
      subtotalCents: 2000,
      discountCents: 0,
      totalCents: 2000,
      cashierId: TEST_USERS.cajero.id,
      cashierName: TEST_USERS.cajero.fullName,
      createdOfflineAt: null,
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
      items: [item1],
    },
    {
      id: '00000000-0000-4000-8000-0000000000o2',
      clientOrderId: '00000000-0000-4000-8000-0000000000c2',
      businessDate: today,
      orderNumber: 2,
      status: 'pendiente',
      paymentMethod: 'qr',
      subtotalCents: 1000,
      discountCents: 0,
      totalCents: 1000,
      cashierId: TEST_USERS.cajero.id,
      cashierName: TEST_USERS.cajero.fullName,
      createdOfflineAt: null,
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
      items: [item2],
    },
  ];
}

export function createFakeOrders(
  catalog: FakeCatalog,
  promotions: FakePromotions,
  initialData = seedOrders(catalog),
): FakeOrders {
  const orders: Order[] = structuredClone(initialData);
  let nextOrderNumber = orders.length + 1;
  let nextEventId = 1;

  const now = new Date().toISOString();
  const events: OrderEvent[] = [
    {
      id: nextEventId++,
      orderId: '00000000-0000-4000-8000-0000000000o1',
      fromStatus: null,
      toStatus: 'pendiente',
      reason: '',
      userId: TEST_USERS.cajero.id,
      userName: TEST_USERS.cajero.fullName,
      createdAt: now,
    },
    {
      id: nextEventId++,
      orderId: '00000000-0000-4000-8000-0000000000o1',
      fromStatus: 'pendiente',
      toStatus: 'en_preparacion',
      reason: '',
      userId: TEST_USERS.cocina.id,
      userName: TEST_USERS.cocina.fullName,
      createdAt: now,
    },
    {
      id: nextEventId++,
      orderId: '00000000-0000-4000-8000-0000000000o1',
      fromStatus: 'en_preparacion',
      toStatus: 'listo',
      reason: '',
      userId: TEST_USERS.cocina.id,
      userName: TEST_USERS.cocina.fullName,
      createdAt: now,
    },
    {
      id: nextEventId++,
      orderId: '00000000-0000-4000-8000-0000000000o2',
      fromStatus: null,
      toStatus: 'pendiente',
      reason: '',
      userId: TEST_USERS.cajero.id,
      userName: TEST_USERS.cajero.fullName,
      createdAt: now,
    },
  ];

  const movements: (OrderKardexMovement & { orderId: string })[] = [
    {
      id: 101,
      orderId: '00000000-0000-4000-8000-0000000000o1',
      ingredientId: '00000000-0000-4000-8000-0000000000i1',
      ingredientName: 'Harina especial',
      unit: 'g',
      type: 'venta',
      quantity: -200,
      costCents: 150,
      balanceQuantity: 4800,
      balanceAvgUnitCost: '0.0075',
      createdAt: now,
    },
  ];

  const reader: OrdersReader = {
    async orders(filters?: OrdersFilter) {
      let filtered = [...orders];
      if (filters?.businessDate) {
        filtered = filtered.filter((o) => o.businessDate === filters.businessDate);
      }
      if (filters?.status) {
        filtered = filtered.filter((o) => o.status === filters.status);
      }
      if (filters?.limit) {
        const offset = filters.offset ?? 0;
        filtered = filtered.slice(offset, offset + filters.limit);
      }
      return structuredClone(filtered);
    },
    async order(id: string) {
      const found = orders.find((o) => o.id === id);
      return found ? structuredClone(found) : null;
    },
    async events(orderId: string) {
      return structuredClone(events.filter((e) => e.orderId === orderId));
    },
    async movements(orderId: string) {
      return structuredClone(
        movements
          .filter((m) => m.orderId === orderId)
          .map(({ orderId: _, ...rest }) => rest),
      );
    },
  };

  function handle(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): unknown {
    if (method === 'POST' && path === '/orders') {
      const input = body as CreateOrderInput;
      const idempotencyKey = headers?.['idempotency-key'];

      if (
        idempotencyKey &&
        idempotencyKey.toLowerCase() !== input.clientOrderId.toLowerCase()
      ) {
        throw new ApiError(
          400,
          'VALIDATION_ERROR',
          'El encabezado Idempotency-Key no coincide con clientOrderId',
          undefined,
          'fake-req',
        );
      }

      // Comprobar idempotencia
      const existing = orders.find((o) => o.clientOrderId === input.clientOrderId);
      if (existing) {
        const sameMethod = existing.paymentMethod === input.paymentMethod;
        const sameCount = (existing.items?.length ?? 0) === input.items.length;
        const sameItems =
          sameCount &&
          input.items.every((it) => {
            const matched = existing.items?.find((ei) => ei.productId === it.productId);
            return (
              matched &&
              matched.quantity === it.quantity &&
              (matched.note || '') === (it.note || '')
            );
          });

        if (sameMethod && sameItems) {
          return structuredClone(existing);
        }

        throw new ApiError(
          409,
          'CONFLICT',
          'IDEMPOTENCY_KEY_REUSED: Ya se envió este pedido con datos distintos',
          { reason: 'IDEMPOTENCY_KEY_REUSED' },
          'fake-req',
        );
      }

      const activePromos = promotions.data.filter((p) => p.isActive);
      const priced = priceCart(input.items, catalog.data.products, activePromos);

      const items: OrderItem[] = priced.lines.map((l, idx) => ({
        lineNo: idx + 1,
        productId: l.productId,
        productName: l.productName,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        promotionId: l.promotionId,
        promotionName: l.promotionName,
        unitDiscountCents: l.unitDiscountCents,
        lineTotalCents: l.lineTotalCents,
        note: l.note,
      }));

      const newOrder: Order = {
        id: crypto.randomUUID(),
        clientOrderId: input.clientOrderId,
        businessDate: toBoliviaDate(),
        orderNumber: nextOrderNumber++,
        status: 'pendiente',
        paymentMethod: input.paymentMethod,
        subtotalCents: priced.subtotalCents,
        discountCents: priced.discountCents,
        totalCents: priced.totalCents,
        cashierId: TEST_USERS.cajero.id,
        cashierName: TEST_USERS.cajero.fullName,
        createdOfflineAt: input.createdOfflineAt ?? null,
        cancelReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items,
      };

      orders.push(newOrder);
      events.push({
        id: nextEventId++,
        orderId: newOrder.id,
        fromStatus: null,
        toStatus: 'pendiente',
        reason: '',
        userId: TEST_USERS.cajero.id,
        userName: TEST_USERS.cajero.fullName,
        createdAt: newOrder.createdAt,
      });

      return structuredClone(newOrder);
    }

    const statusMatch = path.match(/^\/orders\/([^/]+)\/status$/);
    if (method === 'POST' && statusMatch) {
      const id = statusMatch[1];
      const input = body as AdvanceOrderStatusInput;
      const order = orders.find((o) => o.id === id);
      if (!order) {
        throw new ApiError(404, 'NOT_FOUND', 'Pedido no encontrado', undefined, 'fake-req');
      }

      if (!canTransition('admin', order.status, input.to)) {
        throw new ApiError(
          422,
          'BUSINESS_RULE',
          'Transición de estado no permitida',
          { reason: 'INVALID_STATUS_TRANSITION' },
          'fake-req',
        );
      }

      const prevStatus = order.status;
      order.status = input.to;
      order.updatedAt = new Date().toISOString();

      events.push({
        id: nextEventId++,
        orderId: order.id,
        fromStatus: prevStatus,
        toStatus: input.to,
        reason: '',
        userId: TEST_USERS.admin.id,
        userName: TEST_USERS.admin.fullName,
        createdAt: order.updatedAt,
      });

      return structuredClone(order);
    }

    const cancelMatch = path.match(/^\/orders\/([^/]+)\/cancel$/);
    if (method === 'POST' && cancelMatch) {
      const id = cancelMatch[1];
      const input = body as CancelOrderInput;
      const order = orders.find((o) => o.id === id);
      if (!order) {
        throw new ApiError(404, 'NOT_FOUND', 'Pedido no encontrado', undefined, 'fake-req');
      }

      if (!canCancel('admin', order)) {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'No se puede anular un pedido en este estado',
          { reason: 'ORDER_CANCEL_FORBIDDEN' },
          'fake-req',
        );
      }

      const prevStatus = order.status;
      order.status = 'anulado';
      order.cancelReason = input.reason;
      order.updatedAt = new Date().toISOString();

      events.push({
        id: nextEventId++,
        orderId: order.id,
        fromStatus: prevStatus,
        toStatus: 'anulado',
        reason: input.reason,
        userId: TEST_USERS.admin.id,
        userName: TEST_USERS.admin.fullName,
        createdAt: order.updatedAt,
      });

      // Añadir movimiento inverso al kardex
      movements.push({
        id: 1000 + nextEventId,
        orderId: order.id,
        ingredientId: '00000000-0000-4000-8000-0000000000i1',
        ingredientName: 'Harina especial',
        unit: 'g',
        type: 'anulacion',
        quantity: 200,
        costCents: 150,
        balanceQuantity: 5000,
        balanceAvgUnitCost: '0.0075',
        createdAt: order.updatedAt,
      });

      return structuredClone(order);
    }

    return NOT_HANDLED;
  }

  return { data: orders, events, movements, reader, handle };
}
