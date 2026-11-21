import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeSql, serviceClient, sql, type Client } from './helpers.js';
import { inventoryFixtures } from './inventory-fixtures.js';

const fx = inventoryFixtures('rules');
let service: Client;

beforeAll(() => {
  service = serviceClient();
});

afterAll(async () => {
  await fx.cleanupInventory();
  await closeSql();
});

async function getStock(ingredientId: string) {
  const [row] = await sql<{
    quantity: string;
    avg_unit_cost: string;
    min_quantity: number;
  }>(
    `select quantity, avg_unit_cost, min_quantity from public.inventory_stock where ingredient_id = $1`,
    [ingredientId],
  );
  return {
    quantity: Number(row!.quantity),
    avgUnitCost: row!.avg_unit_cost,
    minQuantity: row!.min_quantity,
  };
}

async function getMovements(ingredientId: string) {
  return sql<{
    id: string;
    type: string;
    quantity: number;
    cost_cents: number;
    balance_quantity: string;
    balance_avg_unit_cost: string;
    reason: string;
  }>(
    `select id, type, quantity, cost_cents, balance_quantity, balance_avg_unit_cost, reason
     from public.inventory_movements
     where ingredient_id = $1
     order by id asc`,
    [ingredientId],
  );
}

describe('Alta automática de stock', () => {
  it('crea automáticamente una fila en inventory_stock al crear un insumo', async () => {
    const ingId = await fx.ingredient();
    const stock = await getStock(ingId);
    expect(stock).toEqual({
      quantity: 0,
      avgUnitCost: '0.000000',
      minQuantity: 0,
    });
  });
});

describe('IN-02: Costo promedio ponderado y kardex', () => {
  it('1000g a Bs 8 + 1000g a Bs 12 → promedio 1.000000; merma 500g valorizada a -Bs 5 sin cambiar promedio', async () => {
    const ingId = await fx.ingredient();

    // 1. Compra 1: 1000 g por Bs 8 (800 centavos)
    const { error: err1 } = await service.rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: fx.name('sup'),
      p_note: fx.name('note'),
      p_items: [{ ingredientId: ingId, quantity: 1000, costCents: 800 }],
    });
    expect(err1).toBeNull();

    let stock = await getStock(ingId);
    expect(stock.quantity).toBe(1000);
    expect(Number(stock.avgUnitCost)).toBeCloseTo(0.8, 6);

    // 2. Compra 2: 1000 g por Bs 12 (1200 centavos)
    const { error: err2 } = await service.rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: fx.name('sup'),
      p_note: fx.name('note'),
      p_items: [{ ingredientId: ingId, quantity: 1000, costCents: 1200 }],
    });
    expect(err2).toBeNull();

    stock = await getStock(ingId);
    expect(stock.quantity).toBe(2000);
    // (1000 * 0.8 + 1200) / 2000 = 2000 / 2000 = 1.000000
    expect(Number(stock.avgUnitCost)).toBeCloseTo(1.0, 6);

    // 3. Merma de 500 g: se valoriza al promedio (Bs 1.00/kg => 1 centavo/g => 500 centavos)
    const { error: err3 } = await service.rpc('record_waste', {
      p_ingredient_id: ingId,
      p_quantity: 500,
      p_reason: 'Caducidad en vitrina',
    });
    expect(err3).toBeNull();

    stock = await getStock(ingId);
    expect(stock.quantity).toBe(1500);
    expect(Number(stock.avgUnitCost)).toBeCloseTo(1.0, 6);

    // 4. Verificación de movimientos y saldos en cada paso
    const movements = await getMovements(ingId);
    expect(movements).toHaveLength(3);

    // Movimiento 1
    expect(movements[0]!.type).toBe('compra');
    expect(movements[0]!.quantity).toBe(1000);
    expect(movements[0]!.cost_cents).toBe(800);
    expect(Number(movements[0]!.balance_quantity)).toBe(1000);
    expect(Number(movements[0]!.balance_avg_unit_cost)).toBeCloseTo(0.8, 6);

    // Movimiento 2
    expect(movements[1]!.type).toBe('compra');
    expect(movements[1]!.quantity).toBe(1000);
    expect(movements[1]!.cost_cents).toBe(1200);
    expect(Number(movements[1]!.balance_quantity)).toBe(2000);
    expect(Number(movements[1]!.balance_avg_unit_cost)).toBeCloseTo(1.0, 6);

    // Movimiento 3
    expect(movements[2]!.type).toBe('merma');
    expect(movements[2]!.quantity).toBe(-500);
    expect(movements[2]!.cost_cents).toBe(-500);
    expect(Number(movements[2]!.balance_quantity)).toBe(1500);
    expect(Number(movements[2]!.balance_avg_unit_cost)).toBeCloseTo(1.0, 6);
  });

  it('compra con stock negativo fija el promedio directamente en el de la compra', async () => {
    const ingId = await fx.ingredient();

    // Forzar stock negativo mediante postgres (simulando venta previa sin stock)
    await sql(
      `update public.inventory_stock set quantity = -200, avg_unit_cost = 0.5 where ingredient_id = $1`,
      [ingId],
    );

    // Compra de 500 g a Bs 6,00 (600 centavos) → unit cost = 600 / 500 = 1.2 centavos/g
    const { error } = await service.rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: fx.name('sup'),
      p_note: fx.name('note'),
      p_items: [{ ingredientId: ingId, quantity: 500, costCents: 600 }],
    });
    expect(error).toBeNull();

    const stock = await getStock(ingId);
    expect(stock.quantity).toBe(300); // -200 + 500 = 300
    expect(Number(stock.avgUnitCost)).toBeCloseTo(1.2, 6);
  });
});

describe('IN-03: Validación de merma y conteo físico', () => {
  it('rechaza merma mayor al stock disponible con STOCK_INSUFFICIENT y disponible en detail', async () => {
    const ingId = await fx.ingredient();

    // Cargar 200 g
    await service.rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: fx.name('sup'),
      p_note: fx.name('note'),
      p_items: [{ ingredientId: ingId, quantity: 200, costCents: 100 }],
    });

    // Intentar merma de 250 g
    const { error } = await service.rpc('record_waste', {
      p_ingredient_id: ingId,
      p_quantity: 250,
      p_reason: 'Rotura accidental',
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('STOCK_INSUFFICIENT');
    expect(error!.details).toContain('"available": 200');

    // Comprobar que no se registró ningún movimiento
    const movements = await getMovements(ingId);
    expect(movements).toHaveLength(1); // Solo la compra inicial
    expect(movements[0]!.type).toBe('compra');
  });

  it('rechaza conteo físico igual al stock actual con ADJUSTMENT_NO_CHANGE', async () => {
    const ingId = await fx.ingredient();

    await service.rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: fx.name('sup'),
      p_note: fx.name('note'),
      p_items: [{ ingredientId: ingId, quantity: 300, costCents: 150 }],
    });

    // Contar exactamente 300
    const { error } = await service.rpc('count_stock', {
      p_ingredient_id: ingId,
      p_counted: 300,
      p_reason: 'Conteo mensual rutinario',
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('ADJUSTMENT_NO_CHANGE');

    const movements = await getMovements(ingId);
    expect(movements).toHaveLength(1);
  });

  it('registra ajuste por diferencia en conteo físico cuando difiere', async () => {
    const ingId = await fx.ingredient();

    await service.rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: fx.name('sup'),
      p_note: fx.name('note'),
      p_items: [{ ingredientId: ingId, quantity: 400, costCents: 400 }],
    });

    // Conteo físico da 350 (diferencia de -50)
    const { error } = await service.rpc('count_stock', {
      p_ingredient_id: ingId,
      p_counted: 350,
      p_reason: 'Conteo físico fin de mes',
    });
    expect(error).toBeNull();

    const stock = await getStock(ingId);
    expect(stock.quantity).toBe(350);

    const movements = await getMovements(ingId);
    expect(movements).toHaveLength(2);
    expect(movements[1]!.type).toBe('ajuste');
    expect(movements[1]!.quantity).toBe(-50);
    expect(Number(movements[1]!.balance_quantity)).toBe(350);
    expect(movements[1]!.reason).toBe('Conteo físico fin de mes');
  });
});

describe('IN-06: Atomicidad de compras', () => {
  it('si register_purchase falla en una línea, no queda compra, ítems ni movimientos a medias', async () => {
    const activeIng = await fx.ingredient();
    const inactiveIng = await fx.ingredient({ active: false });

    const supplier = fx.name('sup-atomic');
    const { error } = await service.rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: supplier,
      p_note: fx.name('note-atomic'),
      p_items: [
        { ingredientId: activeIng, quantity: 500, costCents: 250 },
        { ingredientId: inactiveIng, quantity: 500, costCents: 250 },
      ],
    });

    expect(error).not.toBeNull();
    expect(error!.message).toContain('INGREDIENT_INACTIVE');

    // Verificar que no se creó la compra
    const purchases = await sql(`select id from public.purchases where supplier = $1`, [supplier]);
    expect(purchases).toHaveLength(0);

    // Verificar que el insumo activo no tiene movimientos ni cambio de stock
    const movements = await getMovements(activeIng);
    expect(movements).toHaveLength(0);

    const stock = await getStock(activeIng);
    expect(stock.quantity).toBe(0);
  });
});

describe('Límite del total de compra', () => {
  it('rechaza con PURCHASE_TOTAL_TOO_HIGH si la suma de líneas supera 100.000.000 centavos', async () => {
    const ing1 = await fx.ingredient();
    const ing2 = await fx.ingredient();
    const supplier = fx.name('sup-total');

    const { error } = await service.rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: supplier,
      p_note: '',
      p_items: [
        { ingredientId: ing1, quantity: 1, costCents: 60_000_000 },
        { ingredientId: ing2, quantity: 1, costCents: 60_000_000 },
      ],
    });

    expect(error?.code).toBe('P0001');
    expect(error?.message).toBe('PURCHASE_TOTAL_TOO_HIGH');
    expect(
      await sql(`select id from public.purchases where supplier = $1`, [supplier]),
    ).toHaveLength(0);
  });
});

describe('IN-09: Bloqueo de cambio de unidad si hay movimientos', () => {
  it('impide cambiar la unidad de un insumo que tiene movimientos en el kardex', async () => {
    const ingId = await fx.ingredient({ unit: 'g' });

    // Registrar un movimiento
    await service.rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: fx.name('sup'),
      p_note: fx.name('note'),
      p_items: [{ ingredientId: ingId, quantity: 100, costCents: 50 }],
    });

    // Intentar cambiar unidad en ingredients de 'g' a 'ml' debe fallar con INGREDIENT_UNIT_LOCKED
    await expect(
      sql(`update public.ingredients set unit = 'ml' where id = $1`, [ingId]),
    ).rejects.toThrow('INGREDIENT_UNIT_LOCKED');
  });

  it('permite cambiar la unidad si el insumo no tiene movimientos ni receta', async () => {
    const ingId = await fx.ingredient({ unit: 'g' });
    await expect(
      sql(`update public.ingredients set unit = 'ml' where id = $1`, [ingId]),
    ).resolves.toBeDefined();
  });
});
