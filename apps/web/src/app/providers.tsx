import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import type { AuthServices } from '@/features/auth/auth-context';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { CatalogReaderContext, type CatalogReader } from '@/features/catalog/reader';
import type { ApiClient } from '@/lib/api-client';
import { ApiContext } from '@/lib/api-context';
import { createQueryClient } from '@/lib/query-client';

/** Dependencias externas de la app (reales en main.tsx, falsas en pruebas). */
export interface AppServices extends AuthServices {
  api: ApiClient;
  /** Lecturas del catálogo (Supabase + RLS). */
  catalog: CatalogReader;
}

export function AppProviders({
  services,
  children,
}: {
  services: AppServices;
  children: ReactNode;
}) {
  // Un QueryClient por árbol montado (evita compartir caché entre pruebas).
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={services.api}>
        <CatalogReaderContext.Provider value={services.catalog}>
          <AuthProvider services={services}>{children}</AuthProvider>
        </CatalogReaderContext.Provider>
      </ApiContext.Provider>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
