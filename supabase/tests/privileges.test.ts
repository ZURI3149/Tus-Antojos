import { APP_ROLES, type AppRole } from '@tus-antojos/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  anonClient,
  closeSql,
  reloadSchemaUntilVisible,
  SEED_USERS,
  serviceClient,
  signedInClient,
  sql,
  type Client,
} from './helpers.js';

// PL-04: ninguna sesión de cliente puede escribir en public ni ejecutar sus funciones.
// Las pruebas usan clientes reales de Supabase: prueban lo mismo que hará el navegador.

const PERMISSION_DENIED = '42501';

type Actor = AppRole | 'anon';
const ACTORS: Actor[] = ['anon', ...APP_ROLES];

const clients = {} as Record<Actor, Client>;

beforeAll(async () => {
  clients.anon = anonClient();
  for (const role of APP_ROLES) clients[role] = await signedInClient(role);
});

afterAll(async () => {
  await closeSql();
});

describe('escrituras en profiles desde el cliente', () => {
  it.each(ACTORS)('%s no puede insertar', async (actor) => {
    const { error } = await clients[actor]
      .from('profiles')
      .insert({ id: crypto.randomUUID(), role: 'admin', full_name: 'Intruso' });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(ACTORS)('%s no puede actualizar (ni su propio perfil)', async (actor) => {
    const target = actor === 'anon' ? SEED_USERS.cajero.id : SEED_USERS[actor].id;
    const { error } = await clients[actor]
      .from('profiles')
      .update({ role: 'admin', is_active: true })
      .eq('id', target);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(ACTORS)('%s no puede borrar', async (actor) => {
    const { error } = await clients[actor].from('profiles').delete().eq('id', SEED_USERS.admin.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it('los datos del seed siguen intactos', async () => {
    const rows = await sql<{ email: string; role: string }>(
      `select u.email, p.role from public.profiles p join auth.users u using (id) order by u.email`,
    );
    expect(rows).toEqual([
      { email: SEED_USERS.admin.email, role: 'admin' },
      { email: SEED_USERS.cajero.email, role: 'cajero' },
      { email: SEED_USERS.cocina.email, role: 'cocina' },
    ]);
  });
});

describe('lectura de profiles (RLS)', () => {
  it('anon no puede leer', async () => {
    const { data, error } = await clients.anon.from('profiles').select('id');
    expect(error?.code).toBe(PERMISSION_DENIED);
    expect(data).toBeNull();
  });

  it.each(['cajero', 'cocina'] as const)('%s solo ve su propia fila', async (role) => {
    const { data, error } = await clients[role].from('profiles').select('id, role');
    expect(error).toBeNull();
    expect(data).toEqual([{ id: SEED_USERS[role].id, role }]);
  });

  it('admin ve todas las filas', async () => {
    const { data, error } = await clients.admin.from('profiles').select('id').order('id');
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([
      SEED_USERS.cajero.id,
      SEED_USERS.cocina.id,
      SEED_USERS.admin.id,
    ]);
  });
});

describe('usuarios desactivados', () => {
  afterAll(async () => {
    await sql(`update public.profiles set is_active = true where id = $1`, [SEED_USERS.admin.id]);
  });

  it('un admin desactivado deja de ver los perfiles ajenos de inmediato, con el mismo JWT', async () => {
    await sql(`update public.profiles set is_active = false where id = $1`, [SEED_USERS.admin.id]);

    const { data, error } = await clients.admin.from('profiles').select('id');
    expect(error).toBeNull();
    // Solo conserva su propia fila (para que la web pueda mostrar "usuario desactivado").
    expect(data).toEqual([{ id: SEED_USERS.admin.id }]);
  });
});

describe('funciones', () => {
  it('private.current_app_role() no es alcanzable por la API REST', async () => {
    const { error: viaPublic } = await clients.admin.rpc('current_app_role' as never);
    expect(viaPublic?.code).toBe('PGRST202'); // no existe en el esquema expuesto

    const { error: viaPrivate } = await clients.admin
      .schema('private' as never)
      .rpc('current_app_role');
    expect(viaPrivate?.code).toBe('PGRST106'); // esquema no expuesto
  });
});

describe('objetos creados en migraciones futuras', () => {
  const table = 'zz_t6_future_table';
  const fn = 'zz_t6_future_fn';

  beforeAll(async () => {
    // Simula una migración futura: corre como `postgres`, igual que `supabase db push`.
    await sql(`create table public.${table} (id int primary key)`);
    await sql(`create function public.${fn}() returns int language sql as 'select 1'`);
    await reloadSchemaUntilVisible(fn);
  });

  afterAll(async () => {
    await sql(`drop function if exists public.${fn}()`);
    await sql(`drop table if exists public.${table}`);
    await sql(`notify pgrst, 'reload schema'`);
  });

  it('una tabla nueva no concede ningún privilegio a anon ni authenticated', async () => {
    const rows = await sql<{ grantee: string }>(
      `select distinct grantee from information_schema.role_table_grants
       where table_schema = 'public' and table_name = $1 and grantee in ('anon', 'authenticated', 'PUBLIC')`,
      [table],
    );
    expect(rows).toEqual([]);
  });

  it('service_role conserva el acceso completo a la tabla nueva', async () => {
    const rows = await sql<{ ok: boolean }>(
      `select has_table_privilege('service_role', $1, 'select, insert, update, delete') as ok`,
      [`public.${table}`],
    );
    expect(rows[0]?.ok).toBe(true);
  });

  it.each(ACTORS)('%s no puede ejecutar una función nueva de public por rpc()', async (actor) => {
    const { error } = await clients[actor].rpc(fn as never);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it('service_role sí puede ejecutarla (lo que usará NestJS)', async () => {
    const { data, error } = await serviceClient().rpc(fn as never);
    expect(error).toBeNull();
    expect(data).toBe(1);
  });
});

describe('guardas del esquema', () => {
  it('toda tabla de public tiene RLS activo', async () => {
    const rows = await sql<{ relname: string }>(
      `select relname from pg_class
       where relnamespace = 'public'::regnamespace and relkind in ('r', 'p') and not relrowsecurity`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it('ninguna tabla de public tiene políticas de escritura', async () => {
    const rows = await sql<{ tablename: string; policyname: string; cmd: string }>(
      `select tablename, policyname, cmd from pg_policies
       where schemaname = 'public' and cmd <> 'SELECT'`,
    );
    expect(rows).toEqual([]);
  });
});
