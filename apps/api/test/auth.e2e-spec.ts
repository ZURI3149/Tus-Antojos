import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { JWT_KEY_RESOLVER } from '../src/auth/jwt-verifier.js';
import { Public } from '../src/auth/public.decorator.js';
import { UserDirectory, type DirectoryProfile } from '../src/auth/user-directory.service.js';
import { APP_CONFIG } from '../src/config/config.module.js';
import { loadEnv } from '../src/config/env.schema.js';
import { SupabaseService } from '../src/supabase/supabase.service.js';
import { createTestKeys, TEST_SUPABASE_URL } from './support/jwt.js';

const ACTIVE = '00000000-0000-4000-a000-000000000001';
const INACTIVE = '00000000-0000-4000-a000-000000000002';
const NO_PROFILE = '00000000-0000-4000-a000-000000000009';

@Controller('prueba-auth')
class ProbeController {
  @Get('protegido')
  protectedRoute(): string {
    return 'ok';
  }

  @Public()
  @Get('publico')
  publicRoute(): string {
    return 'público';
  }
}

describe('AuthGuard', () => {
  let app: INestApplication;
  let keys: Awaited<ReturnType<typeof createTestKeys>>;

  const profiles: Record<string, DirectoryProfile> = {
    [ACTIVE]: { role: 'cajero', isActive: true },
    [INACTIVE]: { role: 'admin', isActive: false },
  };

  beforeAll(async () => {
    keys = await createTestKeys();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadEnv({
          SUPABASE_URL: TEST_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: 'test',
          LOG_LEVEL: 'silent',
        }),
      )
      .overrideProvider(JWT_KEY_RESOLVER)
      .useValue(keys.jwks)
      .overrideProvider(UserDirectory)
      .useValue({
        getProfile: async (id: string) => profiles[id] ?? null,
        invalidate: () => undefined,
      })
      .overrideProvider(SupabaseService)
      .useValue({ isDatabaseReachable: async () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).get(path);
    return token === undefined ? req : req.set('authorization', token);
  };

  it('sin token → 401 UNAUTHENTICATED con el formato de error', async () => {
    const res = await get('/prueba-auth/protegido').set('x-request-id', 'sin-token').expect(401);
    expect(res.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'No autenticado', requestId: 'sin-token' },
    });
  });

  it.each([
    ['esquema distinto de Bearer', 'Basic dXNlcjpwYXNz'],
    ['Bearer sin token', 'Bearer '],
    ['token basura', 'Bearer no.es.jwt'],
  ])('%s → 401', async (_label, header) => {
    await get('/prueba-auth/protegido', header).expect(401);
  });

  it('token vencido → 401', async () => {
    const token = await keys.sign({ sub: ACTIVE }, { expiresIn: '-1m' });
    await get('/prueba-auth/protegido', `Bearer ${token}`).expect(401);
  });

  it('token válido de usuario activo → 200', async () => {
    const token = await keys.sign({ sub: ACTIVE });
    await get('/prueba-auth/protegido', `Bearer ${token}`).expect(200, 'ok');
  });

  it('acepta "bearer" en minúsculas', async () => {
    const token = await keys.sign({ sub: ACTIVE });
    await get('/prueba-auth/protegido', `bearer ${token}`).expect(200);
  });

  it('usuario desactivado → 403 FORBIDDEN', async () => {
    const token = await keys.sign({ sub: INACTIVE });
    const res = await get('/prueba-auth/protegido', `Bearer ${token}`).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('usuario sin perfil (p. ej. borrado) → 403', async () => {
    const token = await keys.sign({ sub: NO_PROFILE });
    await get('/prueba-auth/protegido', `Bearer ${token}`).expect(403);
  });

  it('@Public() deja pasar sin token', async () => {
    await get('/prueba-auth/publico').expect(200, 'público');
  });

  it('/health es pública', async () => {
    await get('/health').expect(200);
  });

  it('las rutas inexistentes siguen dando 404 (no 401)', async () => {
    await get('/no-existe').expect(404);
  });
});
