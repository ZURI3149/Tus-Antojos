import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, Database } from '@tus-antojos/shared';
import pg from 'pg';
import { inject } from 'vitest';

export const SEED_PASSWORD = 'TusAntojos-local-2026';

export const SEED_USERS = {
  cajero: { id: '00000000-0000-4000-a000-000000000001', email: 'cajero@tusantojos.test' },
  cocina: { id: '00000000-0000-4000-a000-000000000002', email: 'cocina@tusantojos.test' },
  admin: { id: '00000000-0000-4000-a000-000000000003', email: 'admin@tusantojos.test' },
} as const satisfies Record<AppRole, { id: string; email: string }>;

export type Client = SupabaseClient<Database>;

const env = () => inject('dbTestEnv');

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/** Cliente como lo usará el navegador sin sesión (clave pública). */
export function anonClient(): Client {
  return createClient<Database>(env().apiUrl, env().anonKey, clientOptions);
}

/** Cliente del navegador con la sesión del usuario de prueba de ese rol. */
export async function signedInClient(role: AppRole): Promise<Client> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: SEED_USERS[role].email,
    password: SEED_PASSWORD,
  });
  if (error) throw new Error(`No se pudo iniciar sesión como ${role}: ${error.message}`);
  return client;
}

/** Cliente con service_role: lo que usará NestJS. */
export function serviceClient(): Client {
  return createClient<Database>(env().apiUrl, env().serviceRoleKey, clientOptions);
}

let pool: pg.Pool | undefined;

/** Conexión directa como `postgres` para preparar datos e inspeccionar el catálogo. */
export async function sql<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  pool ??= new pg.Pool({ connectionString: env().dbUrl, max: 2 });
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function closeSql(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/** Pide a PostgREST recargar su caché de esquema y espera a que vea `functionName`. */
export async function reloadSchemaUntilVisible(functionName: string): Promise<void> {
  await sql(`notify pgrst, 'reload schema'`);
  const service = serviceClient();
  for (let attempt = 0; attempt < 40; attempt++) {
    // `as never`: la función de prueba no existe en los tipos generados.
    const { error } = await service.rpc(functionName as never);
    if (!error) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`PostgREST no cargó la función ${functionName}`);
}

/** Restaura roles, estado y nombres de los usuarios del seed (para pruebas que los modifican). */
export async function restoreSeedUsers(): Promise<void> {
  const seed: [AppRole, string][] = [
    ['cajero', 'Cajero de Prueba'],
    ['cocina', 'Cocina de Prueba'],
    ['admin', 'Admin de Prueba'],
  ];
  for (const [role, fullName] of seed) {
    const { id } = SEED_USERS[role];
    await sql(
      `update auth.users set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', $2::text)
       where id = $1 and raw_app_meta_data ->> 'role' is distinct from $2`,
      [id, role],
    );
    await sql(`update public.profiles set is_active = true, full_name = $2 where id = $1`, [
      id,
      fullName,
    ]);
  }
}
