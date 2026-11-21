import { describe, expect, it } from 'vitest';
import {
  countStockSchema,
  isDateNotInFuture,
  isIsoDate,
  MAX_PURCHASE_TOTAL_CENTS,
  recordWasteSchema,
  registerPurchaseSchema,
  updateStockSchema,
} from './inventory.schema';

const UUID_1 = '11111111-1111-4111-a111-111111111111';
const UUID_2 = '22222222-2222-4222-a222-222222222222';

describe('isIsoDate & isDateNotInFuture', () => {
  it('valida formato YYYY-MM-DD correcto', () => {
    expect(isIsoDate('2026-11-20')).toBe(true);
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('20-11-2026')).toBe(false);
    expect(isIsoDate('invalid')).toBe(false);
  });

  it('rechaza fechas futuras', () => {
    expect(isDateNotInFuture('2020-01-01')).toBe(true);
    expect(isDateNotInFuture('2099-01-01')).toBe(false);
  });
});

describe('registerPurchaseSchema', () => {
  const validPurchase = {
    purchasedOn: '2026-11-20',
    supplier: 'Distribuidora Central',
    note: 'Compra semanal de insumos',
    items: [
      { ingredientId: UUID_1, quantity: 1000, costCents: 800 },
      { ingredientId: UUID_2, quantity: 500, costCents: 600 },
    ],
  };

  it('valida una compra correcta', () => {
    const res = registerPurchaseSchema.safeParse(validPurchase);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.items).toHaveLength(2);
      expect(res.data.supplier).toBe('Distribuidora Central');
    }
  });

  it('acepta campos opcionales con defaults', () => {
    const minimal = {
      purchasedOn: '2026-11-20',
      items: [{ ingredientId: UUID_1, quantity: 500, costCents: 400 }],
    };
    const res = registerPurchaseSchema.safeParse(minimal);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.supplier).toBe('');
      expect(res.data.note).toBe('');
    }
  });

  it('rechaza compras sin líneas o con más de 50 líneas', () => {
    expect(registerPurchaseSchema.safeParse({ ...validPurchase, items: [] }).success).toBe(false);

    const fiftyOneItems = Array.from({ length: 51 }, (_, i) => ({
      ingredientId: `00000000-0000-4000-a000-${String(i).padStart(12, '0')}`,
      quantity: 100,
      costCents: 100,
    }));
    expect(
      registerPurchaseSchema.safeParse({ ...validPurchase, items: fiftyOneItems }).success,
    ).toBe(false);
  });

  it('rechaza insumos duplicados en la misma compra', () => {
    const duplicated = {
      ...validPurchase,
      items: [
        { ingredientId: UUID_1, quantity: 500, costCents: 400 },
        { ingredientId: UUID_1, quantity: 300, costCents: 200 },
      ],
    };
    const res = registerPurchaseSchema.safeParse(duplicated);
    expect(res.success).toBe(false);
  });

  it('rechaza compras cuyo total supera MAX_PURCHASE_TOTAL_CENTS', () => {
    const res = registerPurchaseSchema.safeParse({
      ...validPurchase,
      items: [
        { ingredientId: UUID_1, quantity: 1, costCents: 60_000_000 },
        { ingredientId: UUID_2, quantity: 1, costCents: 40_000_001 },
      ],
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]!.message).toBe('El total de la compra es demasiado alto');
    }
  });

  it('acepta una compra cuyo total es exactamente MAX_PURCHASE_TOTAL_CENTS', () => {
    const res = registerPurchaseSchema.safeParse({
      ...validPurchase,
      items: [
        { ingredientId: UUID_1, quantity: 1, costCents: 60_000_000 },
        { ingredientId: UUID_2, quantity: 1, costCents: MAX_PURCHASE_TOTAL_CENTS - 60_000_000 },
      ],
    });
    expect(res.success).toBe(true);
  });

  it('rechaza cantidad <= 0 o costo < 0', () => {
    expect(
      registerPurchaseSchema.safeParse({
        ...validPurchase,
        items: [{ ingredientId: UUID_1, quantity: 0, costCents: 100 }],
      }).success,
    ).toBe(false);

    expect(
      registerPurchaseSchema.safeParse({
        ...validPurchase,
        items: [{ ingredientId: UUID_1, quantity: 100, costCents: -1 }],
      }).success,
    ).toBe(false);
  });
});

describe('recordWasteSchema', () => {
  it('valida una merma correcta', () => {
    const res = recordWasteSchema.safeParse({
      ingredientId: UUID_1,
      quantity: 300,
      reason: 'Harina vencida en almacén',
    });
    expect(res.success).toBe(true);
  });

  it('exige motivo entre 3 y 200 caracteres', () => {
    expect(
      recordWasteSchema.safeParse({
        ingredientId: UUID_1,
        quantity: 300,
        reason: 'ab',
      }).success,
    ).toBe(false);

    expect(
      recordWasteSchema.safeParse({
        ingredientId: UUID_1,
        quantity: 300,
        reason: 'a'.repeat(201),
      }).success,
    ).toBe(false);
  });

  it('exige cantidad mayor a cero', () => {
    expect(
      recordWasteSchema.safeParse({
        ingredientId: UUID_1,
        quantity: 0,
        reason: 'Merma por caída',
      }).success,
    ).toBe(false);
  });
});

describe('countStockSchema', () => {
  it('valida un conteo físico correcto (permite 0)', () => {
    const res = countStockSchema.safeParse({
      ingredientId: UUID_1,
      counted: 0,
      reason: 'Conteo de cierre de mes',
    });
    expect(res.success).toBe(true);
  });

  it('rechaza conteo negativo o sin motivo válido', () => {
    expect(
      countStockSchema.safeParse({
        ingredientId: UUID_1,
        counted: -10,
        reason: 'Conteo mensual',
      }).success,
    ).toBe(false);

    expect(
      countStockSchema.safeParse({
        ingredientId: UUID_1,
        counted: 50,
        reason: '',
      }).success,
    ).toBe(false);
  });
});

describe('updateStockSchema', () => {
  it('valida actualización estricta de stock mínimo', () => {
    const res = updateStockSchema.safeParse({ minQuantity: 1500 });
    expect(res.success).toBe(true);
  });

  it('es estricto y rechaza claves adicionales o valores negativos', () => {
    expect(updateStockSchema.safeParse({ minQuantity: 100, extraField: 'invalid' }).success).toBe(
      false,
    );

    expect(updateStockSchema.safeParse({ minQuantity: -5 }).success).toBe(false);
  });
});
