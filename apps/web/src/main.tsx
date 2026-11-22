import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { toast } from 'sonner';
import { AppProviders, type AppServices } from './app/providers';
import { PwaUpdater } from './app/PwaUpdater';
import { createAppRouter } from './app/router';
import { createProfileFetcher } from './features/auth/profile';
import { createSupabaseProductImageStorage } from './features/catalog/images';
import { createSupabaseCatalogReader } from './features/catalog/reader';
import { createSupabaseInventoryReader } from './features/inventory/reader';
import { createSupabasePromotionsReader } from './features/promotions/reader';
import { createApiClient } from './lib/api-client';
import { initWebSentry } from './lib/sentry';
import { getWebEnv } from './lib/env';
import { getSupabase } from './lib/supabase';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root');

initWebSentry(getWebEnv());

const supabase = getSupabase();
const services: AppServices = {
  auth: supabase.auth,
  fetchProfile: createProfileFetcher(supabase),
  api: createApiClient({
    baseUrl: getWebEnv().apiUrl,
    getAccessToken: async () =>
      (await supabase.auth.getSession()).data.session?.access_token ?? null,
    // Sesión inválida en la API: se cierra localmente y RequireRole lleva a /login.
    onUnauthorized: () => void supabase.auth.signOut({ scope: 'local' }),
    onForbidden: (message) => toast.warning(message),
  }),
  catalog: createSupabaseCatalogReader(supabase),
  productImages: createSupabaseProductImageStorage(supabase),
  inventory: createSupabaseInventoryReader(supabase),
  promotions: createSupabasePromotionsReader(supabase),
};

const router = createAppRouter();

createRoot(root).render(
  <StrictMode>
    <AppProviders services={services}>
      <RouterProvider router={router} />
      <PwaUpdater />
    </AppProviders>
  </StrictMode>,
);
