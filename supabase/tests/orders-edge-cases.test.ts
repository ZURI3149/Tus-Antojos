import {
  priceCart,
  type CatalogProductLookup,
  type PromotionPricingCandidate,
} from '@tus-antojos/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeSql, SEED_USERS, serviceClient, sql, type Client } from './helpers.js';
import { ordersFixtures } from './orders-fixtures.js';

const fx = ordersFixtures('edges');
let service: Client;

/** Fecha de Bolivia muy antigua, reservada para la prueba del reinicio del número del día. */
const RESET_DATE = '2020-01-15';
const RESET_OFFLINE_AT = '2020-01-15T15:00:00-04:00';

beforeAll(() => {
  service = serviceClient();
});

afterAll(async () => {
  await fx.cleanup(); // también reajusta los contadores del día (incluido RESET_DATE)
  await closeSql();
});

interface OrderLineJson {
  lineNo: number;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  promotionId: string | null;
  promotionName: string | null;
  unitDiscountCents: number;
  lineTotalCents: number;
}

interface OrderJson {
  id: string;
  orderNumber: number;
  businessDate: string;
  status: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  items: OrderLineJson[];
}

function createOrder(
  items: { productId: string; quantity: number; note?: string }[],
  opts: { createdOfflineAt?: string; cashierId?: string } = {},
) {
  return service.rpc('create_order', {
    p_client_order_id: crypto.randomUUID(),
    p_items: items.map((i) => ({ note: '', ...i })),
    p_payment_method: 'efectivo',
    p_created_offline_at: opts.createdOfflineAt,
    p_cashier_id: opts.cashierId,
  });
}

async function stockOf(ingredientId: string): Promise<number> {
  const [row] = await sql<{ quantity: string }>(
    `select quantity from public.inventory_stock where ingredient_id = $1`,
    [ingredientId],
  );
  return Number(row!.quantity);
}

/** Promoción con ventana de vigencia propia (las del fixture duran ±1 h desde ahora). */
async function promotionWindow(
  productIds: string[],
  opts: {
    kind: 'porcentaje' | 'monto_fijo';
    value: number;
    startsAt: string;
    endsAt: string | null;
    isActive?: boolean;
  },
): Promise<string> {
  const [row] = await sql<{ id: string }>(
    `insert into public.promotions (name, kind, value, starts_at, ends_at, is_active)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [fx.name('promo'), opts.kind, opts.value, opts.startsAt, opts.endsAt, opts.isActive ?? true],
  );
  for (const productId of productIds) {
    await sql(`insert into public.promotion_products (promotion_id, product_id) values ($1, $2)`, [
      row!.id,
      productId,
    ]);
  }
  return row!.id;
}

/** Lee de la BD los productos y promociones para calcular lo mismo con `priceCart`. */
async function pricingInputs(productIds: string[]) {
  const products = await sql<{ id: string; name: string; price_cents: number; is_active: boolean }>(
    `select id, name, price_cents, is_active from public.products where id = any($1)`,
    [productIds],
  );
  const promos = await sql<{
    id: string;
    name: string;
    kind: 'porcentaje' | 'monto_fijo';
    value: number;
    starts_at: Date;
    ends_at: Date | null;
    is_active: boolean;
    product_ids: string[];
  }>(
    `select p.id, p.name, p.kind, p.value, p.starts_at, p.ends_at, p.is_active,
            array_agg(pp.product_id) as product_ids
     from public.promotions p
     join public.promotion_products pp on pp.promotion_id = p.id
     where pp.product_id = any($1)
     group by p.id`,
    [productIds],
  );
  const catalog: CatalogProductLookup[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    priceCents: Number(p.price_cents),
    isActive: p.is_active,
  }));
  const candidates: PromotionPricingCandidate[] = promos.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    value: Number(p.value),
    startsAt: p.starts_at,
    endsAt: p.ends_at,
    isActive: p.is_active,
    productIds: p.product_ids,
  }));
  return { catalog, candidates };
}

function expectSameAsPriceCart(order: OrderJson, expected: ReturnType<typeof priceCart>) {
  const lines = [...order.items].sort((a, b) => a.lineNo - b.lineNo);
  expect(lines).toHaveLength(expected.lines.length);
  expected.lines.forEach((exp, i) => {
    expect(lines[i]).toMatchObject({
      productId: exp.productId,
      quantity: exp.quantity,
      unitPriceCents: exp.unitPriceCents,
      promotionId: exp.promotionId,
      promotionName: exp.promotionName,
      unitDiscountCents: exp.unitDiscountCents,
      lineTotalCents: exp.lineTotalCents,
    });
  });
  expect(order.subtotalCents).toBe(expected.subtotalCents);
  expect(order.discountCents).toBe(expected.discountCents);
  expect(order.totalCents).toBe(expected.totalCents);
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

describe('create_order: kardex y validaciones', () => {
  it('dos líneas del mismo producto se agrupan en un solo movimiento `venta` por insumo', async () => {
    const catId = await fx.category();
    const ingId = await fx.ingredient(1_000);
    const prod = await fx.product(catId, { recipe: [{ ingredientId: ingId, quantity: 300 }] });

    const { data, error } = await createOrder([
      { productId: prod.id, quantity: 1, note: 'Sin crema' },
      { productId: prod.id, quantity: 1, note: 'Con crema' },
    ]);
    expect(error).toBeNull();
    const order = data as unknown as OrderJson;
    expect(order.items).toHaveLength(2);

    const movements = await sql<{ type: string; quantity: string }>(
      `select type, quantity from public.inventory_movements where order_id = $1`,
      [order.id],
    );
    expect(movements).toHaveLength(1);
    expect(movements[0]!.type).toBe('venta');
    expect(Number(movements[0]!.quantity)).toBe(-600);
    expect(await stockOf(ingId)).toBe(400);
  });

  it('PRODUCT_NOT_FOUND no registra pedido, líneas ni movimientos', async () => {
    const catId = await fx.category();
    const ingId = await fx.ingredient(1_000);
    const prod = await fx.product(catId, { recipe: [{ ingredientId: ingId, quantity: 1 }] });
    const clientOrderId = crypto.randomUUID();

    const { error } = await service.rpc('create_order', {
      p_client_order_id: clientOrderId,
      p_items: [
        { productId: prod.id, quantity: 1, note: '' },
        { productId: crypto.randomUUID(), quantity: 1, note: '' },
      ],
      p_payment_method: 'efectivo',
    });
    expect(error?.message).toBe('PRODUCT_NOT_FOUND');

    const [orders] = await sql<{ count: string }>(
      `select count(*) as count from public.orders where client_order_id = $1`,
      [clientOrderId],
    );
    expect(Number(orders!.count)).toBe(0);
    const [movs] = await sql<{ count: string }>(
      `select count(*) as count from public.inventory_movements where ingredient_id = $1`,
      [ingId],
    );
    expect(Number(movs!.count)).toBe(0);
    expect(await stockOf(ingId)).toBe(1_000);
  });

  it('stock insuficiente no rechaza el pedido: el stock queda negativo (D3)', async () => {
    const catId = await fx.category();
    const ingId = await fx.ingredient(3);
    const prod = await fx.product(catId, { recipe: [{ ingredientId: ingId, quantity: 2 }] });

    const { data, error } = await createOrder([{ productId: prod.id, quantity: 5 }]);
    expect(error).toBeNull();
    expect((data as unknown as OrderJson).status).toBe('pendiente');
    expect(await stockOf(ingId)).toBe(-7);
  });
});

describe('create_order: número del día', () => {
  it('un pedido en otra fecha de Bolivia empieza de nuevo en 1', async () => {
    await sql(`delete from public.order_counters where business_date = $1`, [RESET_DATE]);
    const catId = await fx.category();
    const prod = await fx.product(catId);

    const first = await createOrder([{ productId: prod.id, quantity: 1 }], {
      createdOfflineAt: RESET_OFFLINE_AT,
    });
    const second = await createOrder([{ productId: prod.id, quantity: 1 }], {
      createdOfflineAt: RESET_OFFLINE_AT,
    });
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();

    const a = first.data as unknown as OrderJson;
    const b = second.data as unknown as OrderJson;
    expect(a.businessDate).toBe(RESET_DATE);
    expect(a.orderNumber).toBe(1);
    expect(b.orderNumber).toBe(2);
  });

  it('la fecha del día se toma en hora de Bolivia (23:30 -04:00 sigue siendo ese día)', async () => {
    const catId = await fx.category();
    const prod = await fx.product(catId);
    const { data, error } = await createOrder([{ productId: prod.id, quantity: 1 }], {
      createdOfflineAt: '2020-01-15T23:30:00-04:00', // 03:30 UTC del 16
    });
    expect(error).toBeNull();
    expect((data as unknown as OrderJson).businessDate).toBe(RESET_DATE);
  });
});

describe('OR-05: paridad de precios con priceCart', () => {
  it('precio, promoción y totales por línea coinciden con priceCart en el mismo instante', async () => {
    const catId = await fx.category();
    const burger = await fx.product(catId, { priceCents: 2500 });
    const fries = await fx.product(catId, { priceCents: 1000 });
    const juice = await fx.product(catId, { priceCents: 333 });

    // Varias promociones compitiendo: gana el mayor descuento por unidad.
    await promotionWindow([burger.id], {
      kind: 'porcentaje',
      value: 20, // −500
      startsAt: hoursFromNow(-2),
      endsAt: hoursFromNow(2),
    });
    await promotionWindow([burger.id, fries.id], {
      kind: 'monto_fijo',
      value: 300, // −300 en ambas
      startsAt: hoursFromNow(-2),
      endsAt: null,
    });
    await promotionWindow([fries.id], {
      kind: 'porcentaje',
      value: 50, // vencida: no cuenta
      startsAt: hoursFromNow(-48),
      endsAt: hoursFromNow(-24),
    });
    await promotionWindow([juice.id], {
      kind: 'porcentaje',
      value: 33, // redondeo: 333 × 33 % = 109,89
      startsAt: hoursFromNow(-2),
      endsAt: hoursFromNow(2),
    });
    await promotionWindow([juice.id], {
      kind: 'porcentaje',
      value: 90, // desactivada: no cuenta
      startsAt: hoursFromNow(-2),
      endsAt: hoursFromNow(2),
      isActive: false,
    });

    const lines = [
      { productId: burger.id, quantity: 2 },
      { productId: fries.id, quantity: 3 },
      { productId: juice.id, quantity: 1 },
    ];
    const { data, error } = await createOrder(lines);
    expect(error).toBeNull();

    const { catalog, candidates } = await pricingInputs(lines.map((l) => l.productId));
    const expected = priceCart(lines, catalog, candidates, new Date());
    expectSameAsPriceCart(data as unknown as OrderJson, expected);
    // Sanidad: la caja y la BD coinciden en algo no trivial.
    expect(expected.discountCents).toBeGreaterThan(0);
  });

  it('con createdOfflineAt las promociones se evalúan en ese instante, no en el de sincronización', async () => {
    const catId = await fx.category();
    const prod = await fx.product(catId, { priceCents: 2000 });

    const offlineAt = hoursFromNow(-60); // hace 2,5 días
    // Vigente solo entonces (ya venció):
    const past = await promotionWindow([prod.id], {
      kind: 'porcentaje',
      value: 25,
      startsAt: hoursFromNow(-72),
      endsAt: hoursFromNow(-48),
    });
    // Vigente solo ahora (no existía entonces):
    await promotionWindow([prod.id], {
      kind: 'porcentaje',
      value: 50,
      startsAt: hoursFromNow(-1),
      endsAt: hoursFromNow(1),
    });

    const lines = [{ productId: prod.id, quantity: 2 }];
    const { data, error } = await createOrder(lines, { createdOfflineAt: offlineAt });
    expect(error).toBeNull();
    const order = data as unknown as OrderJson;
    expect(order.items[0]!.promotionId).toBe(past);
    expect(order.items[0]!.unitDiscountCents).toBe(500);

    const { catalog, candidates } = await pricingInputs([prod.id]);
    expectSameAsPriceCart(order, priceCart(lines, catalog, candidates, new Date(offlineAt)));
  });
});

describe('advance_order_status y cancel_order: bordes', () => {
  it('repetir la misma transición no falla ni duplica eventos', async () => {
    const catId = await fx.category();
    const prod = await fx.product(catId);
    const { data } = await createOrder([{ productId: prod.id, quantity: 1 }]);
    const orderId = (data as unknown as OrderJson).id;

    for (let i = 0; i < 3; i++) {
      const res = await service.rpc('advance_order_status', {
        p_order_id: orderId,
        p_to_status: 'en_preparacion',
        p_user_id: SEED_USERS.cocina.id,
      });
      expect(res.error).toBeNull();
    }

    const events = await sql<{ from_status: string | null; to_status: string }>(
      `select from_status, to_status from public.order_events where order_id = $1 order by id`,
      [orderId],
    );
    expect(events.map((e) => e.to_status)).toEqual(['pendiente', 'en_preparacion']);
  });

  it('ORDER_CANCEL_FORBIDDEN: el cajero no anula pedidos de otro cajero', async () => {
    const catId = await fx.category();
    const ingId = await fx.ingredient(100);
    const prod = await fx.product(catId, { recipe: [{ ingredientId: ingId, quantity: 1 }] });
    const { data } = await createOrder([{ productId: prod.id, quantity: 1 }], {
      cashierId: SEED_USERS.admin.id,
    });
    const orderId = (data as unknown as OrderJson).id;

    const { error } = await service.rpc('cancel_order', {
      p_order_id: orderId,
      p_reason: 'Intento ajeno',
      p_user_id: SEED_USERS.cajero.id,
      p_only_cashier: SEED_USERS.cajero.id,
    });
    expect(error?.message).toBe('ORDER_CANCEL_FORBIDDEN');

    const [row] = await sql<{ status: string }>(`select status from public.orders where id = $1`, [
      orderId,
    ]);
    expect(row!.status).toBe('pendiente');
    expect(await stockOf(ingId)).toBe(99);
  });

  it('ORDER_CANCEL_FORBIDDEN: el cajero no anula sus propios pedidos de otro día', async () => {
    const catId = await fx.category();
    const prod = await fx.product(catId);
    const { data } = await createOrder([{ productId: prod.id, quantity: 1 }], {
      createdOfflineAt: hoursFromNow(-30),
      cashierId: SEED_USERS.cajero.id,
    });
    const orderId = (data as unknown as OrderJson).id;

    const { error } = await service.rpc('cancel_order', {
      p_order_id: orderId,
      p_reason: 'Ya es otro día',
      p_user_id: SEED_USERS.cajero.id,
      p_only_cashier: SEED_USERS.cajero.id,
    });
    expect(error?.message).toBe('ORDER_CANCEL_FORBIDDEN');

    // El admin (sin p_only_cashier) sí puede.
    const admin = await service.rpc('cancel_order', {
      p_order_id: orderId,
      p_reason: 'Anulado por admin',
      p_user_id: SEED_USERS.admin.id,
    });
    expect(admin.error).toBeNull();
  });
});
