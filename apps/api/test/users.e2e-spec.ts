import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AppRole } from '@tus-antojos/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { JWT_KEY_RESOLVER } from '../src/auth/jwt-verifier.js';
import { UserDirectory } from '../src/auth/user-directory.service.js';
import { APP_CONFIG } from '../src/config/config.module.js';
import { loadEnv } from '../src/config/env.schema.js';
import { UsersService } from '../src/modules/users/users.service.js';
import { SupabaseService } from '../src/supabase/supabase.service.js';
import { createTestKeys, TEST_SUPABASE_URL } from './support/jwt.js';

const IDS: Record<AppRole, string> = {
  cajero: '00000000-0000-4000-a000-000000000001',
  cocina: '00000000-0000-4000-a000-000000000002',
  admin: '00000000-0000-4000-a000-000000000003',
};

describe('/users (permisos y validación)', () => {
  let app: INestApplication;
  const tokens = {} as Record<AppRole, string>;
  const users = { list: vi.fn(), create: vi.fn(), update: vi.fn() };

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
      .overrideProvider(UsersService)
      .useValue(users)
      .overrideProvider(SupabaseService)
      .useValue({ isDatabaseReachable: async () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    users.list.mockReset().mockResolvedValue([]);
    users.create.mockReset().mockResolvedValue({ id: 'nuevo' });
    users.update.mockReset().mockResolvedValue({ id: 'editado' });
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const auth = (role: AppRole) => `Bearer ${tokens[role]}`;
  const validBody = {
    email: 'nuevo@tusantojos.test',
    password: 'clave-segura-1',
    fullName: 'Ana',
    role: 'cajero',
  };

  describe.each(['cajero', 'cocina'] as AppRole[])('%s', (role) => {
    it('GET /users → 403', async () => {
      await http().get('/users').set('authorization', auth(role)).expect(403);
    });
    it('POST /users → 403 (sin llegar al servicio)', async () => {
      await http().post('/users').set('authorization', auth(role)).send(validBody).expect(403);
      expect(users.create).not.toHaveBeenCalled();
    });
    it('PATCH /users/:id → 403', async () => {
      await http()
        .patch(`/users/${IDS.cajero}`)
        .set('authorization', auth(role))
        .send({ role: 'admin' })
        .expect(403);
      expect(users.update).not.toHaveBeenCalled();
    });
  });

  it('sin token → 401', async () => {
    await http().get('/users').expect(401);
  });

  it('admin: GET /users → 200', async () => {
    users.list.mockResolvedValue([{ id: IDS.cajero }]);
    await http()
      .get('/users')
      .set('authorization', auth('admin'))
      .expect(200, [{ id: IDS.cajero }]);
  });

  it('admin: POST /users válido → 201 con los datos normalizados', async () => {
    await http()
      .post('/users')
      .set('authorization', auth('admin'))
      .send({ ...validBody, email: ' NUEVO@TusAntojos.test ' })
      .expect(201);
    expect(users.create).toHaveBeenCalledWith({ ...validBody, email: 'nuevo@tusantojos.test' });
  });

  it('admin: POST /users inválido → 400 con detalles por campo', async () => {
    const res = await http()
      .post('/users')
      .set('authorization', auth('admin'))
      .send({ ...validBody, role: 'mesero', password: '123' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'password',
      'role',
    ]);
    expect(users.create).not.toHaveBeenCalled();
  });

  it('admin: PATCH con id que no es UUID → 400', async () => {
    await http()
      .patch('/users/no-es-uuid')
      .set('authorization', auth('admin'))
      .send({ role: 'admin' })
      .expect(400);
  });

  it('admin: PATCH sin cambios → 400', async () => {
    await http()
      .patch(`/users/${IDS.cajero}`)
      .set('authorization', auth('admin'))
      .send({})
      .expect(400);
  });

  it('admin: PATCH válido pasa el id del admin que actúa', async () => {
    await http()
      .patch(`/users/${IDS.cajero}`)
      .set('authorization', auth('admin'))
      .send({ isActive: false })
      .expect(200);
    expect(users.update).toHaveBeenCalledWith(IDS.cajero, { isActive: false }, IDS.admin);
  });
});
