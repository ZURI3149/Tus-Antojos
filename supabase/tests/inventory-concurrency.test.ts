import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeSql, serviceClient, sql, type Client } from './helpers.js';
import { inventoryFixtures } from './inventory-fixtures.js';

const fx = inventoryFixtures('concurrency');
let service: Client;

beforeAll(() => {
  service = serviceClient();
});

afterAll(async () => {
  await fx.cleanupInventory();
  await closeSql();
});

describe('IN-07: Concurrencia sin pérdida de movimientos ni interbloqueos', () => {
  it('20 operaciones concurrentes sobre 2 insumos dejan stock = Σ cantidades y saldo del último = stock', async () => {
    const ingA = await fx.ingredient();
    const ingB = await fx.ingredient();

    // Carga inicial para tener stock suficiente para las mermas
    const initA = await service.rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: fx.name('init'),
      p_note: '',
      p_items: [{ ingredientId: ingA, quantity: 2000, costCents: 2000 }],
    });
    expect(initA.error).toBeNull();

    const initB = await service.rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: fx.name('init'),
      p_note: '',
      p_items: [{ ingredientId: ingB, quantity: 2000, costCents: 2000 }],
    });
    expect(initB.error).toBeNull();

    // 20 operaciones concurrentes:
    // 5 compras de A (+100) -> +500
    // 5 mermas de A (-50)   -> -250
    // 5 compras de B (+200) -> +1000
    // 5 mermas de B (-80)   -> -400
    const ops: Promise<{ error: unknown }>[] = [];

    for (let i = 0; i < 5; i++) {
      ops.push(
        Promise.resolve(
          service.rpc('register_purchase', {
            p_purchased_on: '2026-11-20',
            p_supplier: fx.name(`buy-a-${i}`),
            p_note: '',
            p_items: [{ ingredientId: ingA, quantity: 100, costCents: 100 }],
          }),
        ),
      );

      ops.push(
        Promise.resolve(
          service.rpc('record_waste', {
            p_ingredient_id: ingA,
            p_quantity: 50,
            p_reason: `Merma concurrente A ${i}`,
          }),
        ),
      );

      ops.push(
        Promise.resolve(
          service.rpc('register_purchase', {
            p_purchased_on: '2026-11-20',
            p_supplier: fx.name(`buy-b-${i}`),
            p_note: '',
            p_items: [{ ingredientId: ingB, quantity: 200, costCents: 200 }],
          }),
        ),
      );

      ops.push(
        Promise.resolve(
          service.rpc('record_waste', {
            p_ingredient_id: ingB,
            p_quantity: 80,
            p_reason: `Merma concurrente B ${i}`,
          }),
        ),
      );
    }

    const results = await Promise.all(ops);
    for (const res of results as { error: unknown }[]) {
      expect(res.error).toBeNull();
    }

    // Esperado A: 2000 + 500 - 250 = 2250
    // Esperado B: 2000 + 1000 - 400 = 2600
    const expectedA = 2250;
    const expectedB = 2600;

    for (const [ingId, expected] of [
      [ingA, expectedA],
      [ingB, expectedB],
    ] as const) {
      // 1. Stock actual en inventory_stock
      const [stockRow] = await sql<{ quantity: string }>(
        `select quantity from public.inventory_stock where ingredient_id = $1`,
        [ingId],
      );
      expect(Number(stockRow!.quantity)).toBe(expected);

      // 2. Suma de todos los movimientos en el kardex
      const [sumRow] = await sql<{ sum: string; count: string }>(
        `select sum(quantity) as sum, count(*) as count
         from public.inventory_movements
         where ingredient_id = $1`,
        [ingId],
      );
      expect(Number(sumRow!.sum)).toBe(expected);
      expect(Number(sumRow!.count)).toBe(1 + 10); // 1 inicial + 10 concurrentes

      // 3. Saldo del último movimiento registrado (id más alto)
      const [lastMov] = await sql<{ balance_quantity: string }>(
        `select balance_quantity
         from public.inventory_movements
         where ingredient_id = $1
         order by id desc
         limit 1`,
        [ingId],
      );
      expect(Number(lastMov!.balance_quantity)).toBe(expected);
    }
  });
});
