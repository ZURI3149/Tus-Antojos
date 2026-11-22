import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeSql, SEED_USERS, serviceClient, sql, type Client } from './helpers.js';
import { ordersFixtures } from './orders-fixtures.js';

const fx = ordersFixtures('concurrency');
let service: Client;

beforeAll(() => {
  service = serviceClient();
});

afterAll(async () => {
  await fx.cleanup();
  await closeSql();
});

type OrderJson = { id: string; orderNumber: number; businessDate: string; replayed: boolean };

async function stockOf(ingredientId: string): Promise<number> {
  const [row] = await sql<{ quantity: string }>(
    `select quantity from public.inventory_stock where ingredient_id = $1`,
    [ingredientId],
  );
  return Number(row!.quantity);
}

/** Suma, cantidad de movimientos y saldo del último movimiento del kardex de un insumo. */
async function kardexOf(ingredientId: string) {
  const [agg] = await sql<{ sum: string | null; count: string }>(
    `select sum(quantity) as sum, count(*) as count
     from public.inventory_movements where ingredient_id = $1`,
    [ingredientId],
  );
  const [last] = await sql<{ balance_quantity: string }>(
    `select balance_quantity from public.inventory_movements
     where ingredient_id = $1 order by id desc limit 1`,
    [ingredientId],
  );
  return {
    sum: Number(agg!.sum ?? 0),
    count: Number(agg!.count),
    lastBalance: last ? Number(last.balance_quantity) : null,
  };
}

function createOrder(productId: string, quantity: number, clientOrderId = crypto.randomUUID()) {
  return Promise.resolve(
    service.rpc('create_order', {
      p_client_order_id: clientOrderId,
      p_items: [{ productId, quantity, note: '' }],
      p_payment_method: 'efectivo',
    }),
  );
}

describe('OR-02 / CE-03: pedidos concurrentes sobre el mismo insumo', () => {
  it('50 pedidos simultáneos: stock final = inicial − Σ consumos, números del día sin repetir y saldo del kardex = stock', async () => {
    const initialStock = 10_000;
    const perUnit = 3;
    const catId = await fx.category();
    const ingId = await fx.ingredient(initialStock);
    const prod = await fx.product(catId, {
      priceCents: 1500,
      recipe: [{ ingredientId: ingId, quantity: perUnit }],
    });

    // Cantidades distintas (1..5) para que un movimiento perdido cambie el total.
    const quantities = Array.from({ length: 50 }, (_, i) => (i % 5) + 1);
    const results = await Promise.all(quantities.map((q) => createOrder(prod.id, q)));

    for (const res of results) expect(res.error).toBeNull();
    const orders = results.map((r) => r.data as unknown as OrderJson);

    // Stock y kardex
    const consumed = quantities.reduce((acc, q) => acc + q * perUnit, 0);
    const expected = initialStock - consumed;
    expect(await stockOf(ingId)).toBe(expected);

    const kardex = await kardexOf(ingId);
    expect(kardex.count).toBe(50); // un movimiento `venta` por pedido
    expect(kardex.sum).toBe(-consumed);
    expect(kardex.lastBalance).toBe(expected);

    // Números del día: 50 distintos y consecutivos (las pruebas de BD corren en serie).
    const numbers = orders.map((o) => o.orderNumber).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(50);
    expect(numbers[49]! - numbers[0]!).toBe(49);

    // Y ningún número repetido en todo el día, contando pedidos de otras pruebas o del seed.
    const dupes = await sql<{ order_number: number }>(
      `select order_number from public.orders
       where business_date = $1 group by order_number having count(*) > 1`,
      [orders[0]!.businessDate],
    );
    expect(dupes).toHaveLength(0);
  });

  it('10 anulaciones concurrentes junto a 10 ventas nuevas no pierden movimientos', async () => {
    const initialStock = 5_000;
    const perUnit = 2;
    const catId = await fx.category();
    const ingId = await fx.ingredient(initialStock);
    const prod = await fx.product(catId, {
      priceCents: 1000,
      recipe: [{ ingredientId: ingId, quantity: perUnit }],
    });

    // 10 pedidos de 4 unidades (−8 cada uno) que después se anulan.
    const toCancel = await Promise.all(Array.from({ length: 10 }, () => createOrder(prod.id, 4)));
    for (const res of toCancel) expect(res.error).toBeNull();
    const cancelIds = toCancel.map((r) => (r.data as unknown as OrderJson).id);
    expect(await stockOf(ingId)).toBe(initialStock - 10 * 8);

    // A la vez: 10 anulaciones (+8 cada una) y 10 ventas nuevas de 1 unidad (−2 cada una).
    const ops = [
      ...cancelIds.map((id) =>
        Promise.resolve(
          service.rpc('cancel_order', {
            p_order_id: id,
            p_reason: 'Prueba de concurrencia',
            p_user_id: SEED_USERS.admin.id,
          }),
        ),
      ),
      ...Array.from({ length: 10 }, () => createOrder(prod.id, 1)),
    ];
    const results = await Promise.all(ops);
    for (const res of results) expect(res.error).toBeNull();

    // Las anulaciones devuelven todo lo descontado: solo quedan las 10 ventas nuevas.
    const expected = initialStock - 10 * perUnit;
    expect(await stockOf(ingId)).toBe(expected);

    const kardex = await kardexOf(ingId);
    expect(kardex.count).toBe(10 + 10 + 10); // ventas anuladas + devoluciones + ventas nuevas
    expect(kardex.sum).toBe(-10 * perUnit);
    expect(kardex.lastBalance).toBe(expected);

    const [cancelled] = await sql<{ count: string }>(
      `select count(*) as count from public.orders where id = any($1) and status = 'anulado'`,
      [cancelIds],
    );
    expect(Number(cancelled!.count)).toBe(10);
  });
});

describe('OR-03 / CE-04: idempotencia con reenvíos en paralelo', () => {
  it('el mismo clientOrderId enviado 5 veces a la vez produce 1 pedido y 1 conjunto de movimientos', async () => {
    const initialStock = 1_000;
    const catId = await fx.category();
    const ingId = await fx.ingredient(initialStock);
    const prod = await fx.product(catId, {
      priceCents: 2000,
      recipe: [{ ingredientId: ingId, quantity: 5 }],
    });

    const clientOrderId = crypto.randomUUID();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createOrder(prod.id, 2, clientOrderId)),
    );

    for (const res of results) expect(res.error).toBeNull();
    const orders = results.map((r) => r.data as unknown as OrderJson);

    // Todos devuelven el mismo pedido; solo uno lo creó.
    expect(new Set(orders.map((o) => o.id)).size).toBe(1);
    expect(orders.filter((o) => !o.replayed)).toHaveLength(1);
    expect(orders.filter((o) => o.replayed)).toHaveLength(4);

    const [count] = await sql<{ count: string }>(
      `select count(*) as count from public.orders where client_order_id = $1`,
      [clientOrderId],
    );
    expect(Number(count!.count)).toBe(1);

    expect(await stockOf(ingId)).toBe(initialStock - 10);
    const kardex = await kardexOf(ingId);
    expect(kardex.count).toBe(1);
    expect(kardex.sum).toBe(-10);
  });

  it('en paralelo, la misma clave con otro contenido se rechaza con IDEMPOTENCY_KEY_REUSED', async () => {
    const catId = await fx.category();
    const ingId = await fx.ingredient(1_000);
    const prod = await fx.product(catId, {
      priceCents: 2000,
      recipe: [{ ingredientId: ingId, quantity: 1 }],
    });

    const clientOrderId = crypto.randomUUID();
    const results = await Promise.all([
      createOrder(prod.id, 1, clientOrderId),
      createOrder(prod.id, 2, clientOrderId),
      createOrder(prod.id, 3, clientOrderId),
    ]);

    // Gana exactamente uno; los otros dos chocan con la clave ya usada.
    const ok = results.filter((r) => r.error === null);
    const reused = results.filter((r) => r.error?.message === 'IDEMPOTENCY_KEY_REUSED');
    expect(ok).toHaveLength(1);
    expect(reused).toHaveLength(2);

    const kardex = await kardexOf(ingId);
    expect(kardex.count).toBe(1);
  });
});
