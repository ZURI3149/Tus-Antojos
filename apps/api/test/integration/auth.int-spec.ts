import { Controller, Get, Req, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import type { AuthenticatedRequest } from '../../src/auth/auth-user.js';
import { Roles } from '../../src/auth/roles.decorator.js';
import { APP_CONFIG } from '../../src/config/config.module.js';
import { loadEnv } from '../../src/config/env.schema.js';
import { createTestKeys } from '../support/jwt.js';

const PASSWORD = 'TusAntojos-local-2026';
const COCINA_ID = '00000000-0000-4000-a000-000000000002';

@Controller('prueba-auth')
class WhoAmIController {
  @Get('yo')
  whoAmI(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  @Roles('admin')
  @Get('solo-admin')
  adminOnly() {
    return 'ok';
  }
}

describe('autenticación contra Supabase local (JWKS y profiles reales)', () => {
  const supabase = inject('localSupabase');
  let app: INestApplication;

  const service = createClient(supabase.apiUrl, supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function accessToken(email: string): Promise<string> {
    const client = createClient(supabase.apiUrl, supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (error || !data.session) throw new Error(`login falló para ${email}: ${error?.message}`);
    return data.session.access_token;
  }

  async function createApp(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [WhoAmIController],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadEnv({
          SUPABASE_URL: supabase.apiUrl,
          SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
          LOG_LEVEL: 'silent',
        }),
      )
      .compile();
    const created = moduleRef.createNestApplication();
    await created.init();
    return created;
  }

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await service.from('profiles').update({ is_active: true }).eq('id', COCINA_ID);
    await app.close();
  });

  it('un token real del cajero del seed → 200 con su id, rol y correo', async () => {
    const token = await accessToken('cajero@tusantojos.test');
    const res = await request(app.getHttpServer())
      .get('/prueba-auth/yo')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual({
      id: '00000000-0000-4000-a000-000000000001',
      role: 'cajero',
      email: 'cajero@tusantojos.test',
    });
  });

  it('checkpoint 2: sin token 401, cocina en ruta de admin 403, admin 200', async () => {
    const server = app.getHttpServer();
    const noToken = await request(server)
      .get('/prueba-auth/solo-admin')
      .set('x-request-id', 'cp2-401')
      .expect(401);
    expect(noToken.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'No autenticado', requestId: 'cp2-401' },
    });

    const cocina = await accessToken('cocina@tusantojos.test');
    const forbidden = await request(server)
      .get('/prueba-auth/solo-admin')
      .set('authorization', `Bearer ${cocina}`)
      .expect(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    const admin = await accessToken('admin@tusantojos.test');
    await request(server)
      .get('/prueba-auth/solo-admin')
      .set('authorization', `Bearer ${admin}`)
      .expect(200, 'ok');
  });

  it('un token falsificado con el mismo kid pero otra clave → 401', async () => {
    const real = await accessToken('admin@tusantojos.test');
    const { kid } = JSON.parse(Buffer.from(real.split('.')[0]!, 'base64url').toString()) as {
      kid: string;
    };
    const forger = await createTestKeys(kid);
    const forged = await forger.sign(
      { sub: '00000000-0000-4000-a000-000000000003', email: 'admin@tusantojos.test' },
      { issuer: `${supabase.apiUrl}/auth/v1` },
    );
    await request(app.getHttpServer())
      .get('/prueba-auth/yo')
      .set('authorization', `Bearer ${forged}`)
      .expect(401);
  });

  it('un usuario desactivado en profiles → 403 (app nueva, sin caché)', async () => {
    const token = await accessToken('cocina@tusantojos.test');
    const { error } = await service
      .from('profiles')
      .update({ is_active: false })
      .eq('id', COCINA_ID);
    expect(error).toBeNull();

    const fresh = await createApp();
    try {
      const res = await request(fresh.getHttpServer())
        .get('/prueba-auth/yo')
        .set('authorization', `Bearer ${token}`)
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    } finally {
      await fresh.close();
    }
  });
});
