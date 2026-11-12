import { createClient } from '@supabase/supabase-js';

export const E2E_EMAIL_PREFIX = 'e2e-';

/** Borra los usuarios que crean las pruebas (antes de empezar y al terminar). */
export async function deleteE2eUsers(): Promise<void> {
  const url = process.env.E2E_SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  for (const user of data.users.filter((u) => u.email?.startsWith(E2E_EMAIL_PREFIX))) {
    await admin.auth.admin.deleteUser(user.id);
  }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  await deleteE2eUsers();
  return deleteE2eUsers; // teardown
}
