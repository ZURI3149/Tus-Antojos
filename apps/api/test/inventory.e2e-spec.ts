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
import { AdjustmentsService } from '../src/modules/inventory/adjustments.service.js';
import { PurchasesService } from '../src/modules/inventory/purchases.service.js';
import { StockService } from '../src/modules/inventory/stock.service.js';
import { SupabaseService } from '../src/supabase/supabase.service.js';
import { createTestKeys, TEST_SUPABASE_URL } from './support/jwt.js';

const IDS: Record<AppRole, string> = {
  cajero: '00000000-0000-4000-a000-000000000001',
  cocina: '00000000-0000-4000-a000-000000000002',
  admin: '00000000-0000-4000-a000-000000000003',
};
const SOME_ID = '00000000-0000-4000-8000-0000000000aa';

const services = {
  stock: { updateMinQuantity: vi.fn() },
  purchases: { register: vi.fn() },
  adjustments: { recordWaste: vi.fn(), countStock: vi.fn() },
};

interface Route {
  method: 'post' | 'patch';
  path: string;
  body: Record<string, unknown>;
  handler: Mock;
  expectedArgs: unknown[];
  invalidBody?: Record<string, unknown>;
}

const ROUTES: Route[] = [
  {
    method: 'post',
    path: '/inventory/purchases',
    body: {
      purchasedOn: '2026-11-20',
      supplier: 'Molino Real',
      note: 'Harina y azúcar',
      items: [{ ingredientId: SOME_ID, quantity: 1000, costCents: 800 }],
    },
    handler: services.purchases.register,
    expectedArgs: [
      {
        purchasedOn: '2026-11-20',
        supplier: 'Molino Real',
        note: 'Harina y azúcar',
        items: [{ ingredientId: SOME_ID, quantity: 1000, costCents: 800 }],
      },
      IDS.admin,
    ],
    invalidBody: { purchasedOn: 'invalid-date', items: [] },
  },
  {
    method: 'post',
    path: '/inventory/waste',
    body: {
      ingredientId: SOME_ID,
      quantity: 500,
      reason: 'Vencimiento en almacén',
    },
    handler: services.adjustments.recordWaste,
    expectedArgs: [
      {
        ingredientId: SOME_ID,
        quantity: 500,
        reason: 'Vencimiento en almacén',
      },
      IDS.admin,
    ],
    invalidBody: { ingredientId: 'not-a-uuid', quantity: -10, reason: 'x' },
  },
  {
    method: 'post',
    path: '/inventory/counts',
    body: {
      ingredientId: SOME_ID,
      counted: 1200,
      reason: 'Conteo fin de mes',
    },
    handler: services.adjustments.countStock,
    expectedArgs: [
      {
        ingredientId: SOME_ID,
        counted: 1200,
        reason: 'Conteo fin de mes',
      },
      IDS.admin,
    ],
    invalidBody: { ingredientId: SOME_ID, counted: -5, reason: 'x' },
  },
  {
    method: 'patch',
    path: `/inventory/stock/${SOME_ID}`,
    body: { minQuantity: 1500 },
    handler: services.stock.updateMinQuantity,
    expectedArgs: [SOME_ID, { minQuantity: 1500 }],
    invalidBody: { minQuantity: -1 },
  },
];

describe('rutas de inventario (permisos y validación)', () => {
  let app: INestApplication;
  let tokens: Record<AppRole, string>;

  beforeAll(async () => {
    const keys = await createTestKeys();
    tokens = {} as Record<AppRole, string>;
    for (const role of Object.keys(IDS) as AppRole[]) {
      tokens[role] = await keys.sign({ sub: IDS[role] });
    }

    const userDirectory = {
      getProfile: async (id: string) => {
        const role = (Object.keys(IDS) as AppRole[]).find((r) => IDS[r] === id);
        return role ? { role, isActive: true } : null;
      },
      invalidate: () => {},
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadEnv({
          SUPABASE_URL: TEST_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: 'test-key',
          LOG_LEVEL: 'silent',
        }),
      )
      .overrideProvider(JWT_KEY_RESOLVER)
      .useValue(keys.jwks)
      .overrideProvider(UserDirectory)
      .useValue(userDirectory)
      .overrideProvider(StockService)
      .useValue(services.stock)
      .overrideProvider(PurchasesService)
      .useValue(services.purchases)
      .overrideProvider(AdjustmentsService)
      .useValue(services.adjustments)
      .overrideProvider(SupabaseService)
      .useValue({ admin: {} })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    for (const group of Object.values(services)) {
      for (const fn of Object.values(group)) fn.mockReset();
    }
    services.purchases.register.mockResolvedValue({ id: SOME_ID });
    services.stock.updateMinQuantity.mockResolvedValue({ ingredientId: SOME_ID });
    services.adjustments.recordWaste.mockResolvedValue({ id: 1 });
    services.adjustments.countStock.mockResolvedValue({ id: 2 });
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
      expect(route.handler).not.toHaveBeenCalled();
    });

    it.each(['cajero', 'cocina'] as const)('%s → 403 sin llegar al servicio', async (role) => {
      await send(route, role).expect(403);
      expect(route.handler).not.toHaveBeenCalled();
    });

    it('admin → llega al servicio con los datos validados', async () => {
      await send(route, 'admin').expect(route.method === 'post' ? 201 : 200);
      expect(route.handler).toHaveBeenCalledWith(...route.expectedArgs);
    });

    if (route.invalidBody) {
      it('admin con datos inválidos → 400 sin llegar al servicio', async () => {
        const res = await send(route, 'admin', route.invalidBody).expect(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(Array.isArray(res.body.error.details)).toBe(true);
        expect(route.handler).not.toHaveBeenCalled();
      });
    }
  });

  it('POST /inventory/purchases con total sobre el tope → 400 sin llegar al RPC', async () => {
    const purchase = ROUTES[0]!;
    const res = await send(purchase, 'admin', {
      purchasedOn: '2026-11-20',
      items: [
        { ingredientId: SOME_ID, quantity: 1, costCents: 60_000_000 },
        {
          ingredientId: '00000000-0000-4000-8000-0000000000bb',
          quantity: 1,
          costCents: 60_000_000,
        },
      ],
    }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(purchase.handler).not.toHaveBeenCalled();
  });
});
