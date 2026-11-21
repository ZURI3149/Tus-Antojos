import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@tus-antojos/shared';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { APP_CONFIG } from '../../src/config/config.module.js';
import { loadEnv } from '../../src/config/env.schema.js';

const SEED_PASSWORD = 'TusAntojos-local-2026';
const PREFIX = `zz-inv-api-${crypto.randomUUID().slice(0, 8)}-`;

describe('inventario contra Supabase local', () => {
  const supabase = inject('localSupabase');
  const service = createClient<Database>(supabase.apiUrl, supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let app: INestApplication;
  let adminToken: string;
  let adminUserId: string;
  let pool: pg.Pool;

  async function sql(text: string, params: unknown[] = []) {
    return pool.query(text, params);
  }

  async function createIngredient(
    name: string,
    unit: 'g' | 'ml' | 'unidad' = 'g',
  ): Promise<string> {
    const { rows } = await sql(
      `insert into public.ingredients (name, unit, is_active) values ($1, $2, true) returning id`,
      [`${PREFIX}${name}`, unit],
    );
    return rows[0]!.id as string;
  }

  async function cleanup() {
    const like = `${PREFIX}%`;
    await sql(
      `delete from public.inventory_movements where ingredient_id in (select id from public.ingredients where name like $1)`,
      [like],
    );
    await sql(
      `delete from public.purchase_items where ingredient_id in (select id from public.ingredients where name like $1)`,
      [like],
    );
    await sql(
      `delete from public.inventory_stock where ingredient_id in (select id from public.ingredients where name like $1)`,
      [like],
    );
    await sql(`delete from public.purchases where supplier like $1 or note like $1`, [like]);
    await sql(`delete from public.ingredients where name like $1`, [like]);
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
    const { data } = await browser.auth.signInWithPassword({
      email: 'admin@tusantojos.test',
      password: SEED_PASSWORD,
    });
    adminToken = data.session!.access_token;
    adminUserId = data.user!.id;
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
    await app?.close();
  });

  describe('POST /inventory/purchases', () => {
    it('registra una compra de múltiples insumos con auditoría y actualiza el stock', async () => {
      const ing1 = await createIngredient('harina', 'g');
      const ing2 = await createIngredient('huevos', 'unidad');

      const body = {
        purchasedOn: '2026-11-20',
        supplier: `${PREFIX}Distribuidora`,
        note: `${PREFIX}Compra semanal`,
        items: [
          { ingredientId: ing1, quantity: 1000, costCents: 800 },
          { ingredientId: ing2, quantity: 30, costCents: 4500 },
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/inventory/purchases')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(typeof res.body.id).toBe('string');

      // Verificar en BD que la compra se creó con created_by = admin
      const { data: purchase } = await service
        .from('purchases')
        .select('*')
        .eq('id', res.body.id)
        .single();
      expect(purchase).not.toBeNull();
      expect(purchase!.supplier).toBe(`${PREFIX}Distribuidora`);
      expect(purchase!.created_by).toBe(adminUserId);

      // Verificar que los stocks se actualizaron
      const { data: stock1 } = await service
        .from('inventory_stock')
        .select('*')
        .eq('ingredient_id', ing1)
        .single();
      expect(Number(stock1!.quantity)).toBe(1000);
      expect(Number(stock1!.avg_unit_cost)).toBeCloseTo(0.8, 6);

      const { data: stock2 } = await service
        .from('inventory_stock')
        .select('*')
        .eq('ingredient_id', ing2)
        .single();
      expect(Number(stock2!.quantity)).toBe(30);
      expect(Number(stock2!.avg_unit_cost)).toBeCloseTo(150, 6);
    });

    it('devuelve 422 BUSINESS_RULE si un insumo está inactivo', async () => {
      const active = await createIngredient('leche', 'ml');
      const inactive = await createIngredient('colorante', 'ml');
      await sql(`update public.ingredients set is_active = false where id = $1`, [inactive]);

      const res = await request(app.getHttpServer())
        .post('/inventory/purchases')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          purchasedOn: '2026-11-20',
          supplier: 'Test',
          note: '',
          items: [
            { ingredientId: active, quantity: 100, costCents: 100 },
            { ingredientId: inactive, quantity: 50, costCents: 50 },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('BUSINESS_RULE');
      expect(res.body.error.details?.reason).toBe('INGREDIENT_INACTIVE');
    });
  });

  describe('PATCH /inventory/stock/:ingredientId', () => {
    it('actualiza el stock mínimo del insumo', async () => {
      const ing = await createIngredient('mantequilla', 'g');

      const res = await request(app.getHttpServer())
        .patch(`/inventory/stock/${ing}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ minQuantity: 2500 });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        ingredientId: ing,
        minQuantity: 2500,
      });

      const { data: stock } = await service
        .from('inventory_stock')
        .select('min_quantity')
        .eq('ingredient_id', ing)
        .single();
      expect(stock!.min_quantity).toBe(2500);
    });

    it('devuelve 404 NOT_FOUND si el insumo no existe', async () => {
      const nonExistent = '00000000-0000-4000-8000-000000000999';
      const res = await request(app.getHttpServer())
        .patch(`/inventory/stock/${nonExistent}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ minQuantity: 500 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /inventory/waste', () => {
    it('registra una merma con motivo y reduce el stock', async () => {
      const ing = await createIngredient('chocolate', 'g');

      // Cargar stock inicial
      await request(app.getHttpServer())
        .post('/inventory/purchases')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          purchasedOn: '2026-11-20',
          supplier: 'Cacao',
          items: [{ ingredientId: ing, quantity: 800, costCents: 1600 }],
        });

      // Merma de 200 g
      const res = await request(app.getHttpServer())
        .post('/inventory/waste')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ingredientId: ing,
          quantity: 200,
          reason: 'Derrame accidental en almacén',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        ingredientId: ing,
        type: 'merma',
        quantity: -200,
        balanceQuantity: 600,
        reason: 'Derrame accidental en almacén',
      });
    });

    it('devuelve 422 STOCK_INSUFFICIENT si la cantidad supera el stock', async () => {
      const ing = await createIngredient('vainilla', 'ml');

      const res = await request(app.getHttpServer())
        .post('/inventory/waste')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ingredientId: ing,
          quantity: 100,
          reason: 'Envase roto',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('BUSINESS_RULE');
      expect(res.body.error.details?.reason).toBe('STOCK_INSUFFICIENT');
    });
  });

  describe('POST /inventory/counts', () => {
    it('registra ajuste por conteo físico cuando difiere del stock', async () => {
      const ing = await createIngredient('azucar', 'g');

      // Cargar 500 g
      await request(app.getHttpServer())
        .post('/inventory/purchases')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          purchasedOn: '2026-11-20',
          supplier: 'Azucarera',
          items: [{ ingredientId: ing, quantity: 500, costCents: 500 }],
        });

      // Conteo físico da 450 (diferencia -50)
      const res = await request(app.getHttpServer())
        .post('/inventory/counts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ingredientId: ing,
          counted: 450,
          reason: 'Conteo mensual de almacén',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        ingredientId: ing,
        type: 'ajuste',
        quantity: -50,
        balanceQuantity: 450,
        reason: 'Conteo mensual de almacén',
      });
    });

    it('devuelve 422 ADJUSTMENT_NO_CHANGE si la cantidad contada es igual al stock actual', async () => {
      const ing = await createIngredient('sal', 'g');

      const res = await request(app.getHttpServer())
        .post('/inventory/counts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ingredientId: ing,
          counted: 0,
          reason: 'Conteo inicial en cero',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('BUSINESS_RULE');
      expect(res.body.error.details?.reason).toBe('ADJUSTMENT_NO_CHANGE');
    });
  });
});
