import { describe, expect, it } from 'vitest';
import {
  advanceOrderStatusSchema,
  cancelOrderSchema,
  createOrderSchema,
  orderLineInputSchema,
} from './orders.schema';

describe('orderLineInputSchema', () => {
  it('acepta una línea válida', () => {
    const res = orderLineInputSchema.safeParse({
      productId: '00000000-0000-4000-e000-000000000001',
      quantity: 2,
      note: 'Sin cebolla',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.note).toBe('Sin cebolla');
    }
  });

  it('por defecto deja la nota vacía', () => {
    const res = orderLineInputSchema.safeParse({
      productId: '00000000-0000-4000-e000-000000000001',
      quantity: 1,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.note).toBe('');
    }
  });

  it('rechaza cantidad 0 o negativa', () => {
    expect(
      orderLineInputSchema.safeParse({
        productId: '00000000-0000-4000-e000-000000000001',
        quantity: 0,
      }).success,
    ).toBe(false);

    expect(
      orderLineInputSchema.safeParse({
        productId: '00000000-0000-4000-e000-000000000001',
        quantity: -1,
      }).success,
    ).toBe(false);
  });

  it('rechaza notas de más de 140 caracteres', () => {
    expect(
      orderLineInputSchema.safeParse({
        productId: '00000000-0000-4000-e000-000000000001',
        quantity: 1,
        note: 'a'.repeat(141),
      }).success,
    ).toBe(false);
  });
});

describe('createOrderSchema', () => {
  const validOrder = {
    clientOrderId: '11111111-1111-4111-a111-111111111111',
    items: [
      {
        productId: '00000000-0000-4000-e000-000000000001',
        quantity: 2,
      },
    ],
    paymentMethod: 'efectivo',
  };

  it('acepta un pedido válido en efectivo', () => {
    expect(createOrderSchema.safeParse(validOrder).success).toBe(true);
  });

  it('acepta pago qr', () => {
    expect(
      createOrderSchema.safeParse({
        ...validOrder,
        paymentMethod: 'qr',
      }).success,
    ).toBe(true);
  });

  it('rechaza pedido sin líneas', () => {
    expect(
      createOrderSchema.safeParse({
        ...validOrder,
        items: [],
      }).success,
    ).toBe(false);
  });

  it('acepta fecha offline en el pasado o presente', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(
      createOrderSchema.safeParse({
        ...validOrder,
        createdOfflineAt: past,
      }).success,
    ).toBe(true);
  });

  it('rechaza fecha offline en el futuro', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const res = createOrderSchema.safeParse({
      ...validOrder,
      createdOfflineAt: future,
    });
    expect(res.success).toBe(false);
  });
});

describe('advanceOrderStatusSchema', () => {
  it('acepta transiciones válidas', () => {
    expect(advanceOrderStatusSchema.safeParse({ to: 'en_preparacion' }).success).toBe(true);
    expect(advanceOrderStatusSchema.safeParse({ to: 'listo' }).success).toBe(true);
    expect(advanceOrderStatusSchema.safeParse({ to: 'entregado' }).success).toBe(true);
  });

  it('rechaza estados no transicionables como anulado o pendiente', () => {
    expect(advanceOrderStatusSchema.safeParse({ to: 'anulado' }).success).toBe(false);
    expect(advanceOrderStatusSchema.safeParse({ to: 'pendiente' }).success).toBe(false);
  });
});

describe('cancelOrderSchema', () => {
  it('acepta un motivo válido', () => {
    expect(cancelOrderSchema.safeParse({ reason: 'Cliente se retiró' }).success).toBe(true);
  });

  it('rechaza motivos menores a 3 caracteres o mayores a 200', () => {
    expect(cancelOrderSchema.safeParse({ reason: 'no' }).success).toBe(false);
    expect(cancelOrderSchema.safeParse({ reason: 'a'.repeat(201) }).success).toBe(false);
  });
});
