import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AppRole } from '@tus-antojos/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { JWT_KEY_RESOLVER } from '../src/auth/jwt-verifier.js';
import { UserDirectory } from '../src/auth/user-directory.service.js';
import { APP_CONFIG } from '../src/config/config.module.js';
import { loadEnv } from '../src/config/env.schema.js';
import { CategoriesService } from '../src/modules/catalog/categories.service.js';
import { IngredientsService } from '../src/modules/catalog/ingredients.service.js';
import { ProductsService } from '../src/modules/catalog/products.service.js';
import { SupabaseService } from '../src/supabase/supabase.service.js';
import { createTestKeys, TEST_SUPABASE_URL } from './support/jwt.js';

// Permisos y validación de las rutas del catálogo, con los servicios simulados.
// El comportamiento contra la BD real está en test/integration/catalog.int-spec.ts.

const IDS: Record<AppRole, string> = {
  cajero: '00000000-0000-4000-a000-000000000001',
  cocina: '00000000-0000-4000-a000-000000000002',
  admin: '00000000-0000-4000-a000-000000000003',
};
const SOME_ID = '00000000-0000-4000-8000-0000000000aa';

const services = {
  categories: { create: vi.fn(), update: vi.fn() },
  ingredients: { create: vi.fn(), update: vi.fn() },
  products: { create: vi.fn(), update: vi.fn(), setRecipe: vi.fn() },
};

interface Route {
  method: 'post' | 'patch' | 'put';
  path: string;
  body: Record<string, unknown>;
  /** Llamada esperada al servicio con el cuerpo ya validado y normalizado. */
  handler: Mock;
  expectedArgs: unknown[];
}

const ROUTES: Route[] = [
  {
    method: 'post',
    path: '/categories',
    body: { name: '  Helados ' },
    handler: services.categories.create,
    expectedArgs: [{ name: 'Helados', sortOrder: 0, isActive: true }],
  },
  {
    method: 'patch',
    path: `/categories/${SOME_ID}`,
    body: { isActive: false },
    handler: services.categories.update,
    expectedArgs: [SOME_ID, { isActive: false }],
  },
  {
    method: 'post',
    path: '/ingredients',
    body: { name: 'Leche', unit: 'ml' },
    handler: services.ingredients.create,
    expectedArgs: [{ name: 'Leche', unit: 'ml', isActive: true }],
  },
  {
    method: 'patch',
    path: `/ingredients/${SOME_ID}`,
    body: { unit: 'g' },
    handler: services.ingredients.update,
    expectedArgs: [SOME_ID, { unit: 'g' }],
  },
  {
    method: 'post',
    path: '/products',
    body: { categoryId: SOME_ID, name: ' Cono ', priceCents: 1250 },
    handler: services.products.create,
    expectedArgs: [
      {
        categoryId: SOME_ID,
        name: 'Cono',
        description: '',
        priceCents: 1250,
        isActive: false,
        recipe: [],
      },
    ],
  },
  {
    method: 'patch',
    path: `/products/${SOME_ID}`,
    body: { priceCents: 1500, description: ' Con chispas ' },
    handler: services.products.update,
    expectedArgs: [SOME_ID, { priceCents: 1500, description: 'Con chispas' }],
  },
  {
    method: 'put',
    path: `/products/${SOME_ID}/recipe`,
    body: { items: [{ ingredientId: SOME_ID, quantity: 1500 }] },
    handler: services.products.setRecipe,
    expectedArgs: [SOME_ID, [{ ingredientId: SOME_ID, quantity: 1500 }]],
  },
];

describe('rutas del catálogo (permisos y validación)', () => {
  let app: INestApplication;
  const tokens = {} as Record<AppRole, string>;

  beforeAll(async () => {
    const keys = await createTestKeys();
    for (const role of Object.keys(IDS) as AppRole[]) {
      tokens[role] = await keys.sign({ sub: IDS[role] });
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadEnv({
          SUPABASE_URL: TEST_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: 't',
          LOG_LEVEL: 'silent',
        }),
      )
      .overrideProvider(JWT_KEY_RESOLVER)
      .useValue(keys.jwks)
      .overrideProvider(UserDirectory)
      .useValue({
        getProfile: async (id: string) => {
          const role = (Object.keys(IDS) as AppRole[]).find((r) => IDS[r] === id);
          return role ? { role, isActive: true } : null;
        },
        invalidate: () => {},
      })
      .overrideProvider(CategoriesService)
      .useValue(services.categories)
      .overrideProvider(IngredientsService)
      .useValue(services.ingredients)
      .overrideProvider(ProductsService)
      .useValue(services.products)
      .overrideProvider(SupabaseService)
      .useValue({ isDatabaseReachable: async () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    for (const route of ROUTES) route.handler.mockReset().mockResolvedValue({ id: SOME_ID });
  });

  afterAll(async () => {
    await app.close();
  });

  const send = (route: Route, role?: AppRole, body: unknown = route.body) => {
    const req = request(app.getHttpServer())[route.method](route.path);
    if (role) req.set('authorization', `Bearer ${tokens[role]}`);
    return req.send(body as object);
  };
  const label = (r: Route) => `${r.method.toUpperCase()} ${r.path.replace(SOME_ID, ':id')}`;

  describe.each(ROUTES.map((r) => [label(r), r] as const))('%s', (_label, route) => {
    it('sin token → 401', async () => {
      await send(route).expect(401);
    });

    it.each(['cajero', 'cocina'] as const)('%s → 403 sin llegar al servicio', async (role) => {
      await send(route, role).expect(403);
      expect(route.handler).not.toHaveBeenCalled();
    });

    it('admin → llega al servicio con los datos validados', async () => {
      await send(route, 'admin').expect(route.method === 'post' ? 201 : 200);
      expect(route.handler).toHaveBeenCalledWith(...route.expectedArgs);
    });

    it('admin con datos inválidos → 400 sin llegar al servicio', async () => {
      const res = await send(route, 'admin', { name: '', extra: true }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(route.handler).not.toHaveBeenCalled();
    });
  });

  it.each([
    ['precio en Bs con decimales', { priceCents: 12.5 }],
    ['precio 0', { priceCents: 0 }],
    ['campo desconocido (la receta va por su ruta)', { recipe: [] }],
  ])('PATCH /products/:id con %s → 400', async (_label, body) => {
    await request(app.getHttpServer())
      .patch(`/products/${SOME_ID}`)
      .set('authorization', `Bearer ${tokens.admin}`)
      .send(body)
      .expect(400);
    expect(services.products.update).not.toHaveBeenCalled();
  });

  it.each([
    ['cantidad no entera (kg sin convertir)', [{ ingredientId: SOME_ID, quantity: 1.5 }]],
    ['cantidad 0', [{ ingredientId: SOME_ID, quantity: 0 }]],
    [
      'insumo repetido',
      [
        { ingredientId: SOME_ID, quantity: 1 },
        { ingredientId: SOME_ID, quantity: 2 },
      ],
    ],
  ])('PUT /products/:id/recipe con %s → 400', async (_label, items) => {
    await request(app.getHttpServer())
      .put(`/products/${SOME_ID}/recipe`)
      .set('authorization', `Bearer ${tokens.admin}`)
      .send({ items })
      .expect(400);
    expect(services.products.setRecipe).not.toHaveBeenCalled();
  });

  it('un id que no es UUID → 400', async () => {
    const res = await request(app.getHttpServer())
      .patch('/categories/no-es-uuid')
      .set('authorization', `Bearer ${tokens.admin}`)
      .send({ isActive: true })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
