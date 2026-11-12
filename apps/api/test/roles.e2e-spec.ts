import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AppRole } from '@tus-antojos/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import type { AuthUser } from '../src/auth/auth-user.js';
import { CurrentUser } from '../src/auth/current-user.decorator.js';
import { JWT_KEY_RESOLVER } from '../src/auth/jwt-verifier.js';
import { Public } from '../src/auth/public.decorator.js';
import { Roles } from '../src/auth/roles.decorator.js';
import { UserDirectory, type DirectoryProfile } from '../src/auth/user-directory.service.js';
import { APP_CONFIG } from '../src/config/config.module.js';
import { loadEnv } from '../src/config/env.schema.js';
import { SupabaseService } from '../src/supabase/supabase.service.js';
import { createTestKeys, TEST_SUPABASE_URL } from './support/jwt.js';

const USERS: Record<AppRole, { id: string; email: string }> = {
  cajero: { id: '00000000-0000-4000-a000-000000000001', email: 'cajero@tusantojos.test' },
  cocina: { id: '00000000-0000-4000-a000-000000000002', email: 'cocina@tusantojos.test' },
  admin: { id: '00000000-0000-4000-a000-000000000003', email: 'admin@tusantojos.test' },
};

@Controller('roles')
class RolesProbeController {
  @Roles('admin')
  @Get('solo-admin')
  adminOnly() {
    return 'ok';
  }

  @Roles('cajero', 'admin')
  @Get('caja')
  pos() {
    return 'ok';
  }

  @Roles('cocina', 'admin')
  @Get('cocina')
  kitchen() {
    return 'ok';
  }

  @Get('cualquiera')
  anyAuthenticated(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Public()
  @Roles('admin')
  @Get('publica-con-roles')
  publicWithRoles() {
    return 'ok';
  }
}

@Roles('admin')
@Controller('roles-clase')
class ClassRolesController {
  @Get('hereda')
  inherits() {
    return 'ok';
  }

  @Roles('cocina')
  @Get('sobrescribe')
  overrides() {
    return 'ok';
  }
}

describe('RolesGuard, @Roles() y @CurrentUser()', () => {
  let app: INestApplication;
  const tokens = {} as Record<AppRole, string>;

  beforeAll(async () => {
    const keys = await createTestKeys();
    for (const role of Object.keys(USERS) as AppRole[]) {
      tokens[role] = await keys.sign({ sub: USERS[role].id, email: USERS[role].email });
    }
    const profiles: Record<string, DirectoryProfile> = Object.fromEntries(
      (Object.keys(USERS) as AppRole[]).map((role) => [USERS[role].id, { role, isActive: true }]),
    );

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RolesProbeController, ClassRolesController],
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
      .useValue({ getProfile: async (id: string) => profiles[id] ?? null, invalidate: () => {} })
      .overrideProvider(SupabaseService)
      .useValue({ isDatabaseReachable: async () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, role?: AppRole) => {
    const req = request(app.getHttpServer()).get(path);
    return role ? req.set('authorization', `Bearer ${tokens[role]}`) : req;
  };

  // Matriz rol × ruta: [ruta, roles permitidos]
  const matrix: [string, AppRole[]][] = [
    ['/roles/solo-admin', ['admin']],
    ['/roles/caja', ['cajero', 'admin']],
    ['/roles/cocina', ['cocina', 'admin']],
    ['/roles/cualquiera', ['cajero', 'cocina', 'admin']],
    ['/roles-clase/hereda', ['admin']],
    ['/roles-clase/sobrescribe', ['cocina']],
  ];

  for (const [path, allowed] of matrix) {
    for (const role of ['cajero', 'cocina', 'admin'] as AppRole[]) {
      const expected = allowed.includes(role) ? 200 : 403;
      it(`${role} → ${path} = ${expected}`, async () => {
        const res = await get(path, role).expect(expected);
        if (expected === 403) {
          expect(res.body.error).toMatchObject({
            code: 'FORBIDDEN',
            message: 'No tienes permiso para realizar esta acción',
          });
        }
      });
    }
  }

  it('sin token, una ruta con @Roles da 401 (no 403): primero autenticación', async () => {
    await get('/roles/solo-admin').expect(401);
  });

  it('@Public() tiene prioridad sobre @Roles()', async () => {
    await get('/roles/publica-con-roles').expect(200);
  });

  it('@CurrentUser() entrega { id, role, email }', async () => {
    const res = await get('/roles/cualquiera', 'cocina').expect(200);
    expect(res.body).toEqual({ id: USERS.cocina.id, role: 'cocina', email: USERS.cocina.email });
  });
});
