import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { categorySchema, ingredientSchema, type Database } from '@tus-antojos/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { APP_CONFIG } from '../../src/config/config.module.js';
import { loadEnv } from '../../src/config/env.schema.js';

// Rutas del catálogo contra Supabase local: tablas, triggers de reglas y RPC reales.

const SEED_PASSWORD = 'TusAntojos-local-2026';
const PREFIX = `zz-api-${crypto.randomUUID().slice(0, 8)}-`;

describe('catálogo contra Supabase local', () => {
  const supabase = inject('localSupabase');
  const service = createClient<Database>(supabase.apiUrl, supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let app: INestApplication;
  let adminToken: string;

  async function cleanup() {
    const like = `${PREFIX}%`;
    await service.from('products').delete().like('name', like);
    await service.from('ingredients').delete().like('name', like);
    await service.from('categories').delete().like('name', like);
  }

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const asAdmin = (req: request.Test) => req.set('authorization', `Bearer ${adminToken}`);
  const http = () => request(app.getHttpServer());

  describe('categorías', () => {
    let categoryId: string;

    it('POST /categories crea y devuelve la categoría', async () => {
      const res = await asAdmin(http().post('/categories'))
        .send({ name: `${PREFIX}Helados`, sortOrder: 3 })
        .expect(201);
      expect(categorySchema.parse(res.body)).toMatchObject({
        name: `${PREFIX}Helados`,
        sortOrder: 3,
        isActive: true,
      });
      categoryId = res.body.id;
    });

    it('nombre repetido sin distinguir mayúsculas → 409 con mensaje en español', async () => {
      const res = await asAdmin(http().post('/categories'))
        .send({ name: `${PREFIX}HELADOS` })
        .expect(409);
      expect(res.body.error.message).toBe('Ya existe una categoría con ese nombre');
    });

    it('PATCH /categories/:id renombra y reordena', async () => {
      const res = await asAdmin(http().patch(`/categories/${categoryId}`))
        .send({ name: `${PREFIX}Helados artesanales`, sortOrder: 1 })
        .expect(200);
      expect(res.body).toMatchObject({ name: `${PREFIX}Helados artesanales`, sortOrder: 1 });
    });

    it('desactivar con productos activos → 422 CATEGORY_IN_USE', async () => {
      const { data: ingredient } = await service
        .from('ingredients')
        .insert({ name: `${PREFIX}Leche`, unit: 'ml' })
        .select()
        .single();
      const { error } = await service.rpc('create_product', {
        p_category_id: categoryId,
        p_name: `${PREFIX}Cono`,
        p_description: '',
        p_price_cents: 1000,
        p_is_active: true,
        p_recipe: [{ ingredient_id: ingredient!.id, quantity: 100 }],
      });
      expect(error).toBeNull();

      const res = await asAdmin(http().patch(`/categories/${categoryId}`))
        .send({ isActive: false })
        .expect(422);
      expect(res.body.error).toMatchObject({
        code: 'BUSINESS_RULE',
        message: 'La categoría tiene productos activos',
        details: { reason: 'CATEGORY_IN_USE', context: { activeProducts: 1 } },
      });
    });

    it('PATCH de una categoría inexistente → 404', async () => {
      await asAdmin(http().patch(`/categories/${crypto.randomUUID()}`))
        .send({ sortOrder: 2 })
        .expect(404);
    });
  });

  describe('insumos', () => {
    let ingredientId: string;

    it('POST /ingredients crea el insumo en su unidad base', async () => {
      const res = await asAdmin(http().post('/ingredients'))
        .send({ name: `${PREFIX}Harina`, unit: 'g' })
        .expect(201);
      expect(ingredientSchema.parse(res.body)).toMatchObject({
        name: `${PREFIX}Harina`,
        unit: 'g',
        isActive: true,
      });
      ingredientId = res.body.id;
    });

    it('una unidad que no es base (kg) → 400', async () => {
      await asAdmin(http().post('/ingredients'))
        .send({ name: `${PREFIX}Azúcar`, unit: 'kg' })
        .expect(400);
    });

    it('nombre repetido → 409', async () => {
      const res = await asAdmin(http().post('/ingredients'))
        .send({ name: `${PREFIX}harina`, unit: 'g' })
        .expect(409);
      expect(res.body.error.message).toBe('Ya existe un insumo con ese nombre');
    });

    it('cambia la unidad mientras no esté en ninguna receta', async () => {
      const res = await asAdmin(http().patch(`/ingredients/${ingredientId}`))
        .send({ unit: 'unidad' })
        .expect(200);
      expect(res.body.unit).toBe('unidad');
    });

    it('en una receta: unidad bloqueada (422) y no se desactiva si un producto activo lo usa (CA-03)', async () => {
      const { data: category } = await service
        .from('categories')
        .insert({ name: `${PREFIX}Panadería` })
        .select()
        .single();
      const { error } = await service.rpc('create_product', {
        p_category_id: category!.id,
        p_name: `${PREFIX}Pan`,
        p_description: '',
        p_price_cents: 500,
        p_is_active: true,
        p_recipe: [{ ingredient_id: ingredientId, quantity: 2 }],
      });
      expect(error).toBeNull();

      const unit = await asAdmin(http().patch(`/ingredients/${ingredientId}`))
        .send({ unit: 'g' })
        .expect(422);
      expect(unit.body.error.details.reason).toBe('INGREDIENT_UNIT_LOCKED');

      const deactivate = await asAdmin(http().patch(`/ingredients/${ingredientId}`))
        .send({ isActive: false })
        .expect(422);
      expect(deactivate.body.error).toMatchObject({
        message: 'El insumo se usa en productos activos',
        details: { reason: 'INGREDIENT_IN_USE', context: { products: [`${PREFIX}Pan`] } },
      });
    });
  });
});
