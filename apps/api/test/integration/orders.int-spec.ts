import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { APP_CONFIG } from '../../src/config/config.module.js';
import { loadEnv } from '../../src/config/env.schema.js';

const SEED_PASSWORD = 'TusAntojos-local-2026';
const PREFIX = `zz-ord-api-${crypto.randomUUID().slice(0, 8)}-`;

describe('orders API contra Supabase local', () => {
  const supabase = inject('localSupabase');

  let app: INestApplication;
  let adminToken: string;
  let cashierToken: string;
  let kitchenToken: string;
  let pool: pg.Pool;

  let categoryId: string;
  let productId: string;
  let inactiveProductId: string;

  async function sql(text: string, params: unknown[] = []) {
    return pool.query(text, params);
  }

  async function cleanup() {
    const like = `${PREFIX}%`;
    const { rows: orderRows } = await sql(
      `select distinct o.id from public.orders o
       join public.order_items oi on oi.order_id = o.id
       join public.products p on p.id = oi.product_id
       where p.name like $1`,
      [like],
    );
    if (orderRows.length > 0) {
      const oids = orderRows.map((r) => r.id as string);
      await sql(`delete from public.inventory_movements where order_id = any($1)`, [oids]);
      await sql(`delete from public.order_events where order_id = any($1)`, [oids]);
      await sql(`delete from public.order_items where order_id = any($1)`, [oids]);
      await sql(`delete from public.orders where id = any($1)`, [oids]);
    }

    await sql(
      `update public.products set is_active = false where name like $1 or category_id in (select id from public.categories where name like $1)`,
      [like],
    );
    await sql(
      `delete from public.recipe_items where product_id in (select id from public.products where name like $1 or category_id in (select id from public.categories where name like $1))`,
      [like],
    );
    await sql(
      `delete from public.products where name like $1 or category_id in (select id from public.categories where name like $1)`,
      [like],
    );
    await sql(
      `delete from public.inventory_stock where ingredient_id in (select id from public.ingredients where name like $1)`,
      [like],
    );
    await sql(`delete from public.ingredients where name like $1`, [like]);
    await sql(`delete from public.categories where name like $1`, [like]);
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: supabase.dbUrl, max: 2 });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadEnv({
          SUPABASE_URL: supabase.apiUrl,
          SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
          LOG_LEVEL: 'silent',
        }),
      )
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const browser = createClient(supabase.apiUrl, supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: adminAuth } = await browser.auth.signInWithPassword({
      email: 'admin@tusantojos.test',
      password: SEED_PASSWORD,
    });
    adminToken = adminAuth.session!.access_token;

    const { data: cashierAuth } = await browser.auth.signInWithPassword({
      email: 'cajero@tusantojos.test',
      password: SEED_PASSWORD,
    });
    cashierToken = cashierAuth.session!.access_token;

    const { data: kitchenAuth } = await browser.auth.signInWithPassword({
      email: 'cocina@tusantojos.test',
      password: SEED_PASSWORD,
    });
    kitchenToken = kitchenAuth.session!.access_token;

    await cleanup();

    // Crear categoría e insumo con stock
    const { rows: catRows } = await sql(
      `insert into public.categories (name, sort_order, is_active) values ($1, 999, true) returning id`,
      [`${PREFIX}Cat`],
    );
    categoryId = catRows[0]!.id as string;

    const { rows: ingRows } = await sql(
      `insert into public.ingredients (name, unit, is_active) values ($1, 'unidad', true) returning id`,
      [`${PREFIX}Ing`],
    );
    const ingredientId = ingRows[0]!.id as string;
    await sql(
      `update public.inventory_stock set quantity = 500, avg_unit_cost = 10 where ingredient_id = $1`,
      [ingredientId],
    );

    // Producto activo con receta
    const { rows: prodRows } = await sql(
      `insert into public.products (category_id, name, description, price_cents, is_active)
       values ($1, $2, '', 2000, false) returning id`,
      [categoryId, `${PREFIX}P1`],
    );
    productId = prodRows[0]!.id as string;
    await sql(
      `insert into public.recipe_items (product_id, ingredient_id, quantity) values ($1, $2, 2)`,
      [productId, ingredientId],
    );
    await sql(`update public.products set is_active = true where id = $1`, [productId]);

    // Producto inactivo
    const { rows: inactRows } = await sql(
      `insert into public.products (category_id, name, description, price_cents, is_active)
       values ($1, $2, '', 1500, false) returning id`,
      [categoryId, `${PREFIX}P_Inact`],
    );
    inactiveProductId = inactRows[0]!.id as string;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    await pool.end();
  });

  describe('POST /orders', () => {
    it('cajero crea pedido exitosamente -> 201 Created', async () => {
      const clientOrderId = crypto.randomUUID();
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          clientOrderId,
          items: [{ productId, quantity: 2, note: 'Para llevar' }],
          paymentMethod: 'efectivo',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        clientOrderId,
        status: 'pendiente',
        paymentMethod: 'efectivo',
        subtotalCents: 4000,
        totalCents: 4000,
      });
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        productId,
        quantity: 2,
        unitPriceCents: 2000,
        lineTotalCents: 4000,
        note: 'Para llevar',
      });
    });

    it('idempotencia: reintento idéntico responde -> 200 OK con el mismo pedido', async () => {
      const clientOrderId = crypto.randomUUID();
      const payload = {
        clientOrderId,
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'qr',
      };

      const first = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send(payload);
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send(payload);
      expect(second.status).toBe(200);
      expect(second.body.id).toBe(first.body.id);
    });

    it('rechaza cuando el encabezado Idempotency-Key no coincide con clientOrderId -> 400 Bad Request', async () => {
      const clientOrderId = crypto.randomUUID();
      const otherId = crypto.randomUUID();

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .set('Idempotency-Key', otherId)
        .send({
          clientOrderId,
          items: [{ productId, quantity: 1 }],
          paymentMethod: 'efectivo',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('falla con 422 BUSINESS_RULE si el producto está inactivo', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          clientOrderId: crypto.randomUUID(),
          items: [{ productId: inactiveProductId, quantity: 1 }],
          paymentMethod: 'efectivo',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('BUSINESS_RULE');
      expect(res.body.error.message).toBe('El producto no está activo para la venta');
    });

    it('rechaza a cocina -> 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({
          clientOrderId: crypto.randomUUID(),
          items: [{ productId, quantity: 1 }],
          paymentMethod: 'efectivo',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /orders/:id/status', () => {
    it('cocina avanza estado de pendiente a en_preparacion y luego a listo', async () => {
      // 1. Crear pedido
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          clientOrderId: crypto.randomUUID(),
          items: [{ productId, quantity: 1 }],
          paymentMethod: 'efectivo',
        });
      const orderId = createRes.body.id as string;

      // 2. Cocina avanza a en_preparacion
      const step1 = await request(app.getHttpServer())
        .post(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ to: 'en_preparacion' });

      expect(step1.status).toBe(200);
      expect(step1.body.status).toBe('en_preparacion');

      // 3. Cocina avanza a listo
      const step2 = await request(app.getHttpServer())
        .post(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ to: 'listo' });

      expect(step2.status).toBe(200);
      expect(step2.body.status).toBe('listo');

      // 4. Cocina NO puede marcar como entregado -> 403
      const step3Forbidden = await request(app.getHttpServer())
        .post(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ to: 'entregado' });

      expect(step3Forbidden.status).toBe(403);

      // 5. Cajero SÍ puede marcar como entregado -> 200
      const step4 = await request(app.getHttpServer())
        .post(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ to: 'entregado' });

      expect(step4.status).toBe(200);
      expect(step4.body.status).toBe('entregado');
    });
  });

  describe('POST /orders/:id/cancel', () => {
    it('cajero anula su pedido pendiente exitosamente', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          clientOrderId: crypto.randomUUID(),
          items: [{ productId, quantity: 1 }],
          paymentMethod: 'efectivo',
        });
      const orderId = createRes.body.id as string;

      const cancelRes = await request(app.getHttpServer())
        .post(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ reason: 'Cancelado a pedido del cliente' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe('anulado');
      expect(cancelRes.body.cancelReason).toBe('Cancelado a pedido del cliente');
    });

    it('admin puede anular pedidos', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          clientOrderId: crypto.randomUUID(),
          items: [{ productId, quantity: 1 }],
          paymentMethod: 'efectivo',
        });
      const orderId = createRes.body.id as string;

      const cancelRes = await request(app.getHttpServer())
        .post(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Anulación administrativa' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe('anulado');
    });
  });
});
