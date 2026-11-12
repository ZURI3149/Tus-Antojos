import { afterAll, describe, expect, it } from 'vitest';
import { closeSql, serviceClient, sql } from './helpers.js';

// Trigger private.sync_profile_from_auth: crea/actualiza profiles desde auth.users.
// Se prueba con auth.admin.createUser() real: Supabase Auth inserta el usuario sin
// app_metadata.role y lo agrega después en la misma transacción.

const service = () => serviceClient();

async function cleanup() {
  const { data } = await service().auth.admin.listUsers({ perPage: 200 });
  for (const user of data.users.filter((u) => u.email?.startsWith('sync-'))) {
    await service().auth.admin.deleteUser(user.id);
  }
}

afterAll(async () => {
  await cleanup();
  await closeSql();
});

describe('sincronización auth.users → profiles', () => {
  it('auth.admin.createUser con rol válido crea el perfil con rol y nombre', async () => {
    const { data, error } = await service().auth.admin.createUser({
      email: 'sync-ok@tusantojos.test',
      password: 'clave-de-prueba-sync',
      email_confirm: true,
      app_metadata: { role: 'cocina' },
      user_metadata: { full_name: 'Sync OK' },
    });
    expect(error).toBeNull();
    const rows = await sql(`select role, full_name, is_active from public.profiles where id = $1`, [
      data.user!.id,
    ]);
    expect(rows).toEqual([{ role: 'cocina', full_name: 'Sync OK', is_active: true }]);
  });

  it.each([
    ['sin rol', {}],
    ['con un rol inexistente', { role: 'mesero' }],
  ])('auth.admin.createUser %s falla y no deja nada en auth.users', async (_label, appMetadata) => {
    const email = `sync-bad-${Object.keys(appMetadata).length}@tusantojos.test`;
    const { error } = await service().auth.admin.createUser({
      email,
      password: 'clave-de-prueba-sync',
      email_confirm: true,
      app_metadata: appMetadata,
    });
    expect(error).not.toBeNull();
    const rows = await sql(`select 1 from auth.users where email = $1`, [email]);
    expect(rows).toEqual([]);
  });

  it('un cambio de rol en app_metadata se refleja en profiles', async () => {
    const { data } = await service().auth.admin.createUser({
      email: 'sync-cambio@tusantojos.test',
      password: 'clave-de-prueba-sync',
      email_confirm: true,
      app_metadata: { role: 'cajero' },
    });
    const id = data.user!.id;
    const { error } = await service().auth.admin.updateUserById(id, {
      app_metadata: { role: 'admin' },
    });
    expect(error).toBeNull();
    const rows = await sql<{ role: string }>(`select role from public.profiles where id = $1`, [
      id,
    ]);
    expect(rows[0]?.role).toBe('admin');
  });
});
