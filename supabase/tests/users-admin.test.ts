import { APP_ROLES, type AppRole } from '@tus-antojos/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  anonClient,
  closeSql,
  restoreSeedUsers,
  SEED_USERS,
  serviceClient,
  signedInClient,
  sql,
  type Client,
} from './helpers.js';

// Funciones de 0002_users_admin. Las usa la API (service_role) en el módulo users.

type Actor = AppRole | 'anon';
const ACTORS: Actor[] = ['anon', ...APP_ROLES];
const service = () => serviceClient();

async function sessionsOf(userId: string): Promise<number> {
  const rows = await sql<{ n: string }>(
    `select count(*) as n from auth.sessions where user_id = $1`,
    [userId],
  );
  return Number(rows[0]?.n);
}

async function profileOf(userId: string) {
  const rows = await sql<{
    role: string;
    is_active: boolean;
    full_name: string;
    meta: Record<string, unknown>;
  }>(
    `select p.role, p.is_active, p.full_name, u.raw_app_meta_data as meta
     from public.profiles p join auth.users u using (id) where p.id = $1`,
    [userId],
  );
  return rows[0];
}

afterEach(async () => {
  await restoreSeedUsers();
});

afterAll(async () => {
  await closeSql();
});

describe('permisos', () => {
  const clients = {} as Record<Actor, Client>;

  beforeAll(async () => {
    clients.anon = anonClient();
    for (const role of APP_ROLES) clients[role] = await signedInClient(role);
  });

  it.each(ACTORS)('%s no puede ejecutar admin_list_users ni admin_update_user', async (actor) => {
    const list = await clients[actor].rpc('admin_list_users', {});
    expect(list.error?.code).toBe('42501');
    const update = await clients[actor].rpc('admin_update_user', {
      p_user_id: SEED_USERS[actor === 'anon' ? 'cajero' : actor].id,
      p_role: 'admin',
    });
    expect(update.error?.code).toBe('42501');
    expect((await profileOf(SEED_USERS.cajero.id))?.role).toBe('cajero');
  });
});

describe('admin_list_users', () => {
  it('lista los usuarios con correo, rol y estado', async () => {
    const { data, error } = await service().rpc('admin_list_users', {});
    expect(error).toBeNull();
    expect(data?.map((u) => [u.email, u.role, u.is_active])).toEqual(
      expect.arrayContaining([
        [SEED_USERS.cajero.email, 'cajero', true],
        [SEED_USERS.cocina.email, 'cocina', true],
        [SEED_USERS.admin.email, 'admin', true],
      ]),
    );
  });

  it('filtra por id', async () => {
    const { data } = await service().rpc('admin_list_users', { p_user_id: SEED_USERS.cocina.id });
    expect(data).toHaveLength(1);
    expect(data?.[0]?.email).toBe(SEED_USERS.cocina.email);
  });
});

describe('admin_update_user', () => {
  it('cambia el rol en app_metadata y en profiles, conservando el resto de app_metadata', async () => {
    const { error } = await service().rpc('admin_update_user', {
      p_user_id: SEED_USERS.cajero.id,
      p_role: 'cocina',
    });
    expect(error).toBeNull();
    const profile = await profileOf(SEED_USERS.cajero.id);
    expect(profile?.role).toBe('cocina');
    expect(profile?.meta).toMatchObject({
      role: 'cocina',
      provider: 'email',
      providers: ['email'],
    });
  });

  it('al cambiar el rol cierra las sesiones del usuario (su refresh token deja de servir)', async () => {
    const client = await signedInClient('cajero');
    expect(await sessionsOf(SEED_USERS.cajero.id)).toBeGreaterThan(0);

    await service().rpc('admin_update_user', { p_user_id: SEED_USERS.cajero.id, p_role: 'cocina' });

    expect(await sessionsOf(SEED_USERS.cajero.id)).toBe(0);
    const { error } = await client.auth.refreshSession();
    expect(error).not.toBeNull();
  });

  it('desactivar cambia is_active y cierra sus sesiones', async () => {
    await signedInClient('cocina');
    await service().rpc('admin_update_user', {
      p_user_id: SEED_USERS.cocina.id,
      p_is_active: false,
    });
    expect((await profileOf(SEED_USERS.cocina.id))?.is_active).toBe(false);
    expect(await sessionsOf(SEED_USERS.cocina.id)).toBe(0);
  });

  it('cambiar solo el nombre no cierra sesiones', async () => {
    await signedInClient('cocina');
    const before = await sessionsOf(SEED_USERS.cocina.id);
    await service().rpc('admin_update_user', {
      p_user_id: SEED_USERS.cocina.id,
      p_full_name: 'Cocina Renombrada',
    });
    expect((await profileOf(SEED_USERS.cocina.id))?.full_name).toBe('Cocina Renombrada');
    expect(await sessionsOf(SEED_USERS.cocina.id)).toBe(before);
  });

  it.each([
    ['quitarle el rol admin', { p_role: 'cajero' as const }],
    ['desactivarlo', { p_is_active: false }],
  ])('LAST_ADMIN: no permite %s al único admin activo', async (_label, change) => {
    const { error } = await service().rpc('admin_update_user', {
      p_user_id: SEED_USERS.admin.id,
      ...change,
    });
    expect(error).toMatchObject({ code: 'P0001', message: 'LAST_ADMIN' });
    const profile = await profileOf(SEED_USERS.admin.id);
    expect([profile?.role, profile?.is_active]).toEqual(['admin', true]);
  });

  it('con otro admin activo sí permite quitarle el rol', async () => {
    await service().rpc('admin_update_user', { p_user_id: SEED_USERS.cocina.id, p_role: 'admin' });
    const { error } = await service().rpc('admin_update_user', {
      p_user_id: SEED_USERS.admin.id,
      p_role: 'cajero',
    });
    expect(error).toBeNull();
    expect((await profileOf(SEED_USERS.admin.id))?.role).toBe('cajero');
  });

  it('USER_NOT_FOUND para un id inexistente', async () => {
    const { error } = await service().rpc('admin_update_user', {
      p_user_id: '00000000-0000-4000-a000-0000000000ff',
      p_is_active: false,
    });
    expect(error).toMatchObject({ code: 'P0001', message: 'USER_NOT_FOUND' });
  });

  it('NOTHING_TO_UPDATE si no se pide ningún cambio', async () => {
    const { error } = await service().rpc('admin_update_user', { p_user_id: SEED_USERS.cajero.id });
    expect(error).toMatchObject({ code: 'P0001', message: 'NOTHING_TO_UPDATE' });
  });
});
