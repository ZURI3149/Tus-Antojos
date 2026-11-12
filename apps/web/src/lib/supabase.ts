import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tus-antojos/shared';
import { getWebEnv } from './env';

let client: SupabaseClient<Database> | undefined;

/**
 * Cliente de Supabase del navegador, con la clave PÚBLICA.
 * Solo sirve para Auth, lecturas (RLS) y Realtime: el sistema nunca escribe desde aquí.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    const env = getWebEnv();
    client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'tus-antojos-auth',
      },
    });
  }
  return client;
}
