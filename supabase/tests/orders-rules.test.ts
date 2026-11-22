import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeSql, serviceClient, sql, type Client } from './helpers.js';
import { ordersFixtures } from './orders-fixtures.js';

const fx = ordersFixtures('rules');
let service: Client;

beforeAll(() => {
  service = serviceClient();
});

afterAll(async () => {
  await fx.cleanup();
  await closeSql();
});

describe('public.create_order', () => {
  it('crea un pedido, descuenta stock de la receta en el kardex y devuelve replayed: false', async () => {
    const catId = await fx.category();
    const ingId = await fx.ingredient(500);
    // Cada unidad del producto consume 5 unidades del insumo
    const prod = await fx.product(catId, {
      priceCents: 2000,
      recipe: [{ ingredientId: ingId, quantity: 5 }],
    });

    const clientOrderId = crypto.randomUUID();
    const { data, error } = await service.rpc('create_order', {
      p_client_order_id: clientOrderId,
      p_items: [{ productId: prod.id, quantity: 3, note: 'Bien frío' }],
      p_payment_method: 'efectivo',
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({
      clientOrderId,
      status: 'pendiente',
      paymentMethod: 'efectivo',
      subtotalCents: 6000,
      discountCents: 0,
      totalCents: 6000,
      replayed: false,
    });
    expect((data as { items: unknown[] }).items).toHaveLength(1);
    expect((data as { items: unknown[] }).items[0]).toMatchObject({
      quantity: 3,
      unitPriceCents: 2000,
      lineTotalCents: 6000,
      note: 'Bien frío',
    });

    // Verificar que el stock bajó 3 * 5 = 15 unidades: de 500 a 485
    const [stockRow] = await sql<{ quantity: string }>(
      `select quantity from public.inventory_stock where ingredient_id = $1`,
      [ingId],
    );
    expect(Number(stockRow?.quantity)).toBe(485);

    // Verificar el movimiento en inventory_movements con type 'venta' y FK order_id
    const [mov] = await sql<{ type: string; quantity: number; order_id: string }>(
      `select type, quantity, order_id from public.inventory_movements where order_id = $1`,
      [(data as { id: string }).id],
    );
    expect(mov).toMatchObject({
      type: 'venta',
      quantity: -15,
      order_id: (data as { id: string }).id,
    });
  });

  it('aplica automáticamente la mejor promoción vigente calculada por la BD', async () => {
    const catId = await fx.category();
    const prod = await fx.product(catId, { priceCents: 3000 });
    // Promoción de 20% sobre 3000 = 600 centavos de descuento unitario
    await fx.promotion(prod.id, 20, 'porcentaje');

    const clientOrderId = crypto.randomUUID();
    const { data, error } = await service.rpc('create_order', {
      p_client_order_id: clientOrderId,
      p_items: [{ productId: prod.id, quantity: 2 }],
      p_payment_method: 'qr',
    });

    expect(error).toBeNull();
    // Subtotal: 2 * 3000 = 6000. Descuento: 2 * 600 = 1200. Total: 4800.
    expect(data).toMatchObject({
      subtotalCents: 6000,
      discountCents: 1200,
      totalCents: 4800,
      paymentMethod: 'qr',
    });
    expect((data as { items: unknown[] }).items[0]).toMatchObject({
      unitPriceCents: 3000,
      unitDiscountCents: 600,
      lineTotalCents: 4800,
    });
  });

  it('idempotencia: reenvío idéntico devuelve pedido existente con replayed: true sin duplicar stock', async () => {
    const catId = await fx.category();
    const ingId = await fx.ingredient(200);
    const prod = await fx.product(catId, {
      priceCents: 1500,
      recipe: [{ ingredientId: ingId, quantity: 10 }],
    });

    const clientOrderId = crypto.randomUUID();
    const payload = {
      p_client_order_id: clientOrderId,
      p_items: [{ productId: prod.id, quantity: 2 }],
      p_payment_method: 'efectivo' as const,
    };

    const first = await service.rpc('create_order', payload);
    expect(first.error).toBeNull();
    expect((first.data as { replayed: boolean }).replayed).toBe(false);

    // Reenvío idéntico
    const second = await service.rpc('create_order', payload);
    expect(second.error).toBeNull();
    expect((second.data as { replayed: boolean }).replayed).toBe(true);
    expect((second.data as { id: string }).id).toBe((first.data as { id: string }).id);

    // El stock solo debe haber bajado 2 * 10 = 20 (200 -> 180), no 40
    const [stockRow] = await sql<{ quantity: string }>(
      `select quantity from public.inventory_stock where ingredient_id = $1`,
      [ingId],
    );
    expect(Number(stockRow?.quantity)).toBe(180);
  });

  it('idempotencia: reenvío con mismo client_order_id pero distinto contenido falla con IDEMPOTENCY_KEY_REUSED', async () => {
    const catId = await fx.category();
    const prod = await fx.product(catId, { priceCents: 1500 });
    const clientOrderId = crypto.randomUUID();

    await service.rpc('create_order', {
      p_client_order_id: clientOrderId,
      p_items: [{ productId: prod.id, quantity: 1 }],
      p_payment_method: 'efectivo',
    });

    // Mismo ID pero cambia la cantidad
    const conflict = await service.rpc('create_order', {
      p_client_order_id: clientOrderId,
      p_items: [{ productId: prod.id, quantity: 2 }],
      p_payment_method: 'efectivo',
    });

    expect(conflict.error).toMatchObject({
      code: 'P0001',
      message: 'IDEMPOTENCY_KEY_REUSED',
    });
  });

  it('falla con PRODUCT_INACTIVE si algún producto no está activo y no registra nada', async () => {
    const catId = await fx.category();
    const prod = await fx.product(catId, { active: false });
    const clientOrderId = crypto.randomUUID();

    const res = await service.rpc('create_order', {
      p_client_order_id: clientOrderId,
      p_items: [{ productId: prod.id, quantity: 1 }],
      p_payment_method: 'efectivo',
    });

    expect(res.error).toMatchObject({
      code: 'P0001',
      message: 'PRODUCT_INACTIVE',
    });

    const [orderExists] = await sql(`select 1 from public.orders where client_order_id = $1`, [
      clientOrderId,
    ]);
    expect(orderExists).toBeUndefined();
  });
});

describe('public.advance_order_status', () => {
  it('avanza estados en la secuencia permitida y rechaza saltos o retrocesos', async () => {
    const catId = await fx.category();
    const prod = await fx.product(catId);
    const { data } = await service.rpc('create_order', {
      p_client_order_id: crypto.randomUUID(),
      p_items: [{ productId: prod.id, quantity: 1 }],
      p_payment_method: 'efectivo',
    });
    const orderId = (data as { id: string }).id;

    // pendiente -> en_preparacion (permitido)
    const step1 = await service.rpc('advance_order_status', {
      p_order_id: orderId,
      p_to_status: 'en_preparacion',
    });
    expect(step1.error).toBeNull();
    expect((step1.data as { status: string }).status).toBe('en_preparacion');

    // reintento idempotente en_preparacion -> en_preparacion
    const step1Repeat = await service.rpc('advance_order_status', {
      p_order_id: orderId,
      p_to_status: 'en_preparacion',
    });
    expect(step1Repeat.error).toBeNull();

    // en_preparacion -> entregado (inválido, debe pasar por listo)
    const invalidSkip = await service.rpc('advance_order_status', {
      p_order_id: orderId,
      p_to_status: 'entregado',
    });
    expect(invalidSkip.error).toMatchObject({
      code: 'P0001',
      message: 'INVALID_STATUS_TRANSITION',
    });

    // en_preparacion -> listo (permitido)
    const step2 = await service.rpc('advance_order_status', {
      p_order_id: orderId,
      p_to_status: 'listo',
    });
    expect(step2.error).toBeNull();
    expect((step2.data as { status: string }).status).toBe('listo');

    // listo -> entregado (permitido)
    const step3 = await service.rpc('advance_order_status', {
      p_order_id: orderId,
      p_to_status: 'entregado',
    });
    expect(step3.error).toBeNull();
    expect((step3.data as { status: string }).status).toBe('entregado');
  });
});

describe('public.cancel_order', () => {
  it('anula el pedido y revierte en el kardex exactamente los insumos descontados', async () => {
    const catId = await fx.category();
    const ingId = await fx.ingredient(300);
    const prod = await fx.product(catId, {
      priceCents: 2000,
      recipe: [{ ingredientId: ingId, quantity: 4 }],
    });

    const { data } = await service.rpc('create_order', {
      p_client_order_id: crypto.randomUUID(),
      p_items: [{ productId: prod.id, quantity: 5 }],
      p_payment_method: 'efectivo',
    });
    const orderId = (data as { id: string }).id;

    // Stock tras compra: bajó 5 * 4 = 20 unidades: 300 -> 280
    let [stock] = await sql<{ quantity: string }>(
      `select quantity from public.inventory_stock where ingredient_id = $1`,
      [ingId],
    );
    expect(Number(stock?.quantity)).toBe(280);

    // Anular el pedido
    const cancelRes = await service.rpc('cancel_order', {
      p_order_id: orderId,
      p_reason: 'El cliente cambió de parecer',
    });
    expect(cancelRes.error).toBeNull();
    expect((cancelRes.data as { status: string }).status).toBe('anulado');
    expect((cancelRes.data as { cancelReason: string }).cancelReason).toBe(
      'El cliente cambió de parecer',
    );

    // Stock tras anulación: recuperó las 20 unidades exactas: 280 -> 300
    [stock] = await sql<{ quantity: string }>(
      `select quantity from public.inventory_stock where ingredient_id = $1`,
      [ingId],
    );
    expect(Number(stock?.quantity)).toBe(300);

    // Movimiento anulacion registrado en el kardex
    const movements = await sql<{ type: string; quantity: number }>(
      `select type, quantity from public.inventory_movements where order_id = $1 order by id asc`,
      [orderId],
    );
    expect(movements).toHaveLength(2);
    expect(movements[0]).toMatchObject({ type: 'venta', quantity: -20 });
    expect(movements[1]).toMatchObject({ type: 'anulacion', quantity: 20 });
  });

  it('no permite anular un pedido que ya está listo o entregado', async () => {
    const catId = await fx.category();
    const prod = await fx.product(catId);
    const { data } = await service.rpc('create_order', {
      p_client_order_id: crypto.randomUUID(),
      p_items: [{ productId: prod.id, quantity: 1 }],
      p_payment_method: 'efectivo',
    });
    const orderId = (data as { id: string }).id;

    await service.rpc('advance_order_status', {
      p_order_id: orderId,
      p_to_status: 'en_preparacion',
    });
    await service.rpc('advance_order_status', { p_order_id: orderId, p_to_status: 'listo' });

    const cancelRes = await service.rpc('cancel_order', {
      p_order_id: orderId,
      p_reason: 'Ya no se puede',
    });
    expect(cancelRes.error).toMatchObject({
      code: 'P0001',
      message: 'ORDER_NOT_CANCELLABLE',
    });
  });
});
