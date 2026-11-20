import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const E2E_EMAIL_PREFIX = 'e2e-';
/** Prefijo de los nombres del catálogo que crean las pruebas (no choca con el seed). */
export const E2E_CATALOG_PREFIX = 'E2E ';

function serviceClient(): SupabaseClient {
  const url = process.env.E2E_SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltan E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Borra los usuarios que crean las pruebas (antes de empezar y al terminar). */
export async function deleteE2eUsers(admin = serviceClient()): Promise<void> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  for (const user of data.users.filter((u) => u.email?.startsWith(E2E_EMAIL_PREFIX))) {
    await admin.auth.admin.deleteUser(user.id);
  }
}

/** Borra el catálogo que crean las pruebas, con las fotos de sus productos. */
export async function deleteE2eCatalog(admin = serviceClient()): Promise<void> {
  const like = `${E2E_CATALOG_PREFIX}%`;
  const { data: products, error } = await admin.from('products').select('id').like('name', like);
  if (error) throw error;
  const bucket = admin.storage.from('product-images');
  for (const { id } of products) {
    const { data: files } = await bucket.list(`products/${id}`);
    if (files?.length) await bucket.remove(files.map((f) => `products/${id}/${f.name}`));
  }
  // Productos primero (sus recetas caen en cascada), luego lo que referencian.
  await admin.from('products').delete().like('name', like);
  await admin.from('ingredients').delete().like('name', like);
  await admin.from('categories').delete().like('name', like);
}

async function cleanup(): Promise<void> {
  const admin = serviceClient();
  await deleteE2eUsers(admin);
  await deleteE2eCatalog(admin);
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  await cleanup();
  return cleanup; // teardown
}
