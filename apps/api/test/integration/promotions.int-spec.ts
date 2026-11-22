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
const PREFIX = `zz-promo-api-${crypto.randomUUID().slice(0, 8)}-`;

describe('promotions contra Supabase local', () => {
  const supabase = inject('localSupabase');

  let app: INestApplication;
  let adminToken: string;
  let adminUserId: string;
  let cashierToken: string;
  let kitchenToken: string;
  let pool: pg.Pool;

  let categoryId: string;
  let productId: string;
  let secondProductId: string;

  async function sql(text: string, params: unknown[] = []) {
    return pool.query(text, params);
  }

  async function cleanup() {
    const like = `${PREFIX}%`;
    await sql(
      `delete from public.promotion_products where promotion_id in (select id from public.promotions where name like $1)`,
      [like],
    );
    await sql(`delete from public.promotions where name like $1`, [like]);
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
    await sql(`delete from public.categories where name like $1`, [like]);
    // El insumo de la receta también es de la prueba (su stock lo crea un trigger).
    await sql(
      `delete from public.inventory_stock where ingredient_id in (select id from public.ingredients where name like $1)`,
      [like],
    );
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

    // Admin token & userId
    const { data: adminAuth } = await browser.auth.signInWithPassword({
      email: 'admin@tusantojos.test',
      password: SEED_PASSWORD,
    });
    adminToken = adminAuth.session!.access_token;
    adminUserId = adminAuth.user!.id;

    // Cajero token
    const { data: cashierAuth } = await browser.auth.signInWithPassword({
      email: 'cajero@tusantojos.test',
      password: SEED_PASSWORD,
    });
    cashierToken = cashierAuth.session!.access_token;

    // Cocina token
    const { data: kitchenAuth } = await browser.auth.signInWithPassword({
      email: 'cocina@tusantojos.test',
      password: SEED_PASSWORD,
    });
    kitchenToken = kitchenAuth.session!.access_token;

    await cleanup();

    // Crear categoría y productos de prueba (con recetas para evitar PRODUCT_WITHOUT_RECIPE)
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

    const { rows: prod1Rows } = await sql(
      `insert into public.products (category_id, name, description, price_cents, is_active)
       values ($1, $2, '', 2500, false) returning id`,
      [categoryId, `${PREFIX}P1`],
    );
    productId = prod1Rows[0]!.id as string;
    await sql(
      `insert into public.recipe_items (product_id, ingredient_id, quantity) values ($1, $2, 1)`,
      [productId, ingredientId],
    );
    await sql(`update public.products set is_active = true where id = $1`, [productId]);

    const { rows: prod2Rows } = await sql(
      `insert into public.products (category_id, name, description, price_cents, is_active)
       values ($1, $2, '', 3000, false) returning id`,
      [categoryId, `${PREFIX}P2`],
    );
    secondProductId = prod2Rows[0]!.id as string;
    await sql(
      `insert into public.recipe_items (product_id, ingredient_id, quantity) values ($1, $2, 1)`,
      [secondProductId, ingredientId],
    );
    await sql(`update public.products set is_active = true where id = $1`, [secondProductId]);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
    await pool.end();
  });

  const asAdmin = (req: request.Test) => req.set('authorization', `Bearer ${adminToken}`);
  const asCashier = (req: request.Test) => req.set('authorization', `Bearer ${cashierToken}`);
  const asKitchen = (req: request.Test) => req.set('authorization', `Bearer ${kitchenToken}`);
  const http = () => request(app.getHttpServer());

  describe('POST /promotions', () => {
    it('admin crea promoción → 201 { id } y created_by corresponde al token', async () => {
      const payload = {
        name: `${PREFIX}Promo 10%`,
        kind: 'porcentaje',
        value: 10,
        startsAt: new Date().toISOString(),
        productIds: [productId],
      };

      const res = await asAdmin(http().post('/promotions')).send(payload).expect(201);

      expect(res.body).toHaveProperty('id');
      const promoId = res.body.id;

      // Verificar en base de datos que created_by es el usuario admin
      const { rows } = await sql(
        `select created_by, is_active from public.promotions where id = $1`,
        [promoId],
      );
      expect(rows[0]!.created_by).toBe(adminUserId);
      expect(rows[0]!.is_active).toBe(true);

      // Verificar tabla pivote
      const { rows: linkRows } = await sql(
        `select product_id from public.promotion_products where promotion_id = $1`,
        [promoId],
      );
      expect(linkRows).toHaveLength(1);
      expect(linkRows[0]!.product_id).toBe(productId);
    });

    it('cajero → 403 FORBIDDEN', async () => {
      await asCashier(http().post('/promotions'))
        .send({
          name: `${PREFIX}Promo Cajero`,
          kind: 'porcentaje',
          value: 10,
          startsAt: new Date().toISOString(),
          productIds: [productId],
        })
        .expect(403);
    });

    it('cocina → 403 FORBIDDEN', async () => {
      await asKitchen(http().post('/promotions'))
        .send({
          name: `${PREFIX}Promo Cocina`,
          kind: 'porcentaje',
          value: 10,
          startsAt: new Date().toISOString(),
          productIds: [productId],
        })
        .expect(403);
    });

    it('sin autenticación → 401 UNAUTHENTICATED', async () => {
      await http()
        .post('/promotions')
        .send({
          name: `${PREFIX}Promo Anon`,
          kind: 'porcentaje',
          value: 10,
          startsAt: new Date().toISOString(),
          productIds: [productId],
        })
        .expect(401);
    });

    it('validación falla (payload inválido) → 400 VALIDATION_ERROR', async () => {
      const res = await asAdmin(http().post('/promotions'))
        .send({
          name: '',
          kind: 'porcentaje',
          value: 0,
          startsAt: 'not-a-date',
          productIds: [],
        })
        .expect(400);

      expect(res.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('nombre repetido → 409 CONFLICT', async () => {
      const payload = {
        name: `${PREFIX}Promo Duplicada`,
        kind: 'monto_fijo',
        value: 200,
        startsAt: new Date().toISOString(),
        productIds: [productId],
      };

      await asAdmin(http().post('/promotions')).send(payload).expect(201);

      const res = await asAdmin(http().post('/promotions')).send(payload).expect(409);
      expect(res.body.error).toMatchObject({
        code: 'CONFLICT',
        message: 'Ya existe una promoción activa con este nombre',
      });
    });

    it('producto inexistente → 404 NOT_FOUND', async () => {
      const res = await asAdmin(http().post('/promotions'))
        .send({
          name: `${PREFIX}Promo Prod Inexistente`,
          kind: 'porcentaje',
          value: 15,
          startsAt: new Date().toISOString(),
          productIds: [crypto.randomUUID()],
        })
        .expect(404);

      expect(res.body.error).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Producto no encontrado',
      });
    });
  });

  describe('PATCH /promotions/:id', () => {
    let promoId: string;

    beforeAll(async () => {
      const { rows } = await sql(
        `select public.create_promotion($1, 'porcentaje', 20, now(), array[$2]::uuid[], null, $3) as id`,
        [`${PREFIX}Promo Para Editar`, productId, adminUserId],
      );
      promoId = rows[0]!.id as string;
    });

    it('admin edita promoción (nombre, valor, productos, isActive) → 200', async () => {
      const res = await asAdmin(http().patch(`/promotions/${promoId}`))
        .send({
          name: `${PREFIX}Promo Editada`,
          value: 30,
          isActive: false,
          productIds: [secondProductId],
        })
        .expect(200);

      expect(res.body).toEqual({ id: promoId });

      const { rows } = await sql(
        `select name, value, is_active from public.promotions where id = $1`,
        [promoId],
      );
      expect(rows[0]!.name).toBe(`${PREFIX}Promo Editada`);
      expect(rows[0]!.value).toBe(30);
      expect(rows[0]!.is_active).toBe(false);

      const { rows: linkRows } = await sql(
        `select product_id from public.promotion_products where promotion_id = $1`,
        [promoId],
      );
      expect(linkRows).toHaveLength(1);
      expect(linkRows[0]!.product_id).toBe(secondProductId);
    });

    it('cajero → 403 FORBIDDEN', async () => {
      await asCashier(http().patch(`/promotions/${promoId}`))
        .send({ isActive: true })
        .expect(403);
    });

    it('cocina → 403 FORBIDDEN', async () => {
      await asKitchen(http().patch(`/promotions/${promoId}`))
        .send({ isActive: true })
        .expect(403);
    });

    it('promoción inexistente → 404 NOT_FOUND', async () => {
      const nonExistent = crypto.randomUUID();
      const res = await asAdmin(http().patch(`/promotions/${nonExistent}`))
        .send({ name: `${PREFIX}Promo Desconocida` })
        .expect(404);

      expect(res.body.error).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Promoción no encontrada',
      });
    });

    it('actualizar con producto inexistente → 404 NOT_FOUND', async () => {
      const nonExistentProd = crypto.randomUUID();
      const res = await asAdmin(http().patch(`/promotions/${promoId}`))
        .send({ productIds: [nonExistentProd] })
        .expect(404);

      expect(res.body.error).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Producto no encontrado',
      });
    });
  });
});
