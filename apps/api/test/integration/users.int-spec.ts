import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import { userSchema } from '@tus-antojos/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { APP_CONFIG } from '../../src/config/config.module.js';
import { loadEnv } from '../../src/config/env.schema.js';

// T13 contra Supabase local: Auth real, trigger de perfiles real y RPC reales.

const SEED_PASSWORD = 'TusAntojos-local-2026';
const ADMIN_ID = '00000000-0000-4000-a000-000000000003';
const NEW_EMAIL = 't13-nuevo@tusantojos.test';
const NEW_PASSWORD = 'clave-de-prueba-t13';

describe('/users contra Supabase local', () => {
  const supabase = inject('localSupabase');
  const service = createClient(supabase.apiUrl, supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const browser = () =>
    createClient(supabase.apiUrl, supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  let app: INestApplication;
  let adminToken: string;
  let createdId: string | undefined;

  async function signIn(email: string, password: string) {
    const client = browser();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    return { client, session: data.session, error };
  }

  async function deleteTestUsers() {
    const { data } = await service.auth.admin.listUsers({ perPage: 200 });
    for (const user of data.users.filter((u) => u.email?.startsWith('t13-'))) {
      await service.auth.admin.deleteUser(user.id);
    }
  }

  beforeAll(async () => {
    await deleteTestUsers();
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
    const admin = await signIn('admin@tusantojos.test', SEED_PASSWORD);
    adminToken = admin.session!.access_token;
  });

  afterAll(async () => {
    await deleteTestUsers();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) => req.set('authorization', `Bearer ${adminToken}`);

  it('GET /users lista a los usuarios del seed', async () => {
    const res = await asAdmin(http().get('/users')).expect(200);
    expect(res.body.map((u: { email: string }) => u.email)).toEqual(
      expect.arrayContaining([
        'cajero@tusantojos.test',
        'cocina@tusantojos.test',
        'admin@tusantojos.test',
      ]),
    );
    for (const user of res.body) expect(userSchema.safeParse(user).success).toBe(true);
  });

  it('POST /users crea un cajero que puede iniciar sesión de inmediato (PL-08)', async () => {
    const res = await asAdmin(http().post('/users'))
      .send({ email: NEW_EMAIL, password: NEW_PASSWORD, fullName: 'Nuevo Cajero', role: 'cajero' })
      .expect(201);
    expect(res.body).toMatchObject({
      email: NEW_EMAIL,
      fullName: 'Nuevo Cajero',
      role: 'cajero',
      isActive: true,
    });
    createdId = res.body.id;

    const { session, error } = await signIn(NEW_EMAIL, NEW_PASSWORD);
    expect(error).toBeNull();
    const token = session!.access_token;
    // Con su propio token, entra a la API (aunque no a /users, que es solo admin).
    await http().get('/users').set('authorization', `Bearer ${token}`).expect(403);
  });

  it('correo repetido → 409 CONFLICT', async () => {
    const res = await asAdmin(http().post('/users'))
      .send({ email: NEW_EMAIL, password: NEW_PASSWORD, fullName: 'Otro', role: 'cocina' })
      .expect(409);
    expect(res.body.error.message).toBe('Ya existe un usuario con ese correo');
  });

  it('rol inválido → 400 y no se crea nada en Auth', async () => {
    await asAdmin(http().post('/users'))
      .send({
        email: 't13-invalido@tusantojos.test',
        password: NEW_PASSWORD,
        fullName: 'X',
        role: 'mesero',
      })
      .expect(400);
    const { data } = await service.auth.admin.listUsers({ perPage: 200 });
    expect(data.users.some((u) => u.email === 't13-invalido@tusantojos.test')).toBe(false);
  });

  it('PATCH role: actualiza app_metadata y profiles, e invalida su refresh token', async () => {
    const before = await signIn(NEW_EMAIL, NEW_PASSWORD);

    const res = await asAdmin(http().patch(`/users/${createdId}`))
      .send({ role: 'cocina' })
      .expect(200);
    expect(res.body.role).toBe('cocina');

    const { data } = await service.auth.admin.getUserById(createdId!);
    expect(data.user?.app_metadata).toMatchObject({ role: 'cocina', provider: 'email' });
    const { error } = await before.client.auth.refreshSession();
    expect(error).not.toBeNull();
  });

  it('PATCH isActive=false: su token vigente recibe 403 en la siguiente petición (caché invalidada)', async () => {
    const { session } = await signIn(NEW_EMAIL, NEW_PASSWORD);
    const token = session!.access_token;
    const probe = () => http().get('/users').set('authorization', `Bearer ${token}`);

    // Primera petición: llena la caché de UserDirectory con el perfil activo.
    await probe().expect(403);
    await asAdmin(http().patch(`/users/${createdId}`))
      .send({ isActive: false })
      .expect(200);

    const res = await probe().expect(403);
    expect(res.body.error.message).toBe('Tu usuario no está activo');
  });

  it('un admin no puede desactivarse a sí mismo → 422 SELF_MODIFICATION', async () => {
    const res = await asAdmin(http().patch(`/users/${ADMIN_ID}`))
      .send({ isActive: false })
      .expect(422);
    expect(res.body.error.details).toEqual({ reason: 'SELF_MODIFICATION' });
  });

  it('usuario inexistente → 404', async () => {
    await asAdmin(http().patch('/users/00000000-0000-4000-a000-0000000000ff'))
      .send({ isActive: false })
      .expect(404);
  });
});
