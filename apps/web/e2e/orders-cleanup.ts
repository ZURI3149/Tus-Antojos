import { createClient } from '@supabase/supabase-js';
import { SEED_PASSWORD, SEED_USERS } from './support';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} (lo define playwright.config.ts)`);
  return value;
}

/** Cliente con la service role del Supabase LOCAL (solo lectura de verificación y limpieza). */
export function serviceClient() {
  return createClient(env('E2E_SUPABASE_URL'), env('E2E_SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Deja el stock como estaba: el admin anula por la API los pedidos que creó una prueba.
 * (Los pedidos no se borran: el historial y el kardex son append-only.)
 */
export async function cancelOrdersByClientId(clientOrderIds: string[]): Promise<void> {
  if (clientOrderIds.length === 0) return;
  const { data: orders } = await serviceClient()
    .from('orders')
    .select('id, status')
    .in('client_order_id', clientOrderIds);
  const browser = createClient(env('E2E_SUPABASE_URL'), env('E2E_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await browser.auth.signInWithPassword({
    email: SEED_USERS.admin.email,
    password: SEED_PASSWORD,
  });
  const token = data.session?.access_token;
  for (const order of orders ?? []) {
    if (order.status !== 'pendiente' && order.status !== 'en_preparacion') continue;
    await fetch(`${env('E2E_API_URL')}/orders/${order.id}/cancel`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Limpieza de una prueba E2E' }),
    });
  }
}
