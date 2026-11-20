import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import type { AuthServices } from '@/features/auth/auth-context';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ProductImageStorageContext, type ProductImageStorage } from '@/features/catalog/images';
import { CatalogReaderContext, type CatalogReader } from '@/features/catalog/reader';
import type { ApiClient } from '@/lib/api-client';
import { ApiContext } from '@/lib/api-context';
import { createQueryClient } from '@/lib/query-client';

/** Dependencias externas de la app (reales en main.tsx, falsas en pruebas). */
export interface AppServices extends AuthServices {
  api: ApiClient;
  /** Lecturas del catálogo (Supabase + RLS). */
  catalog: CatalogReader;
  /** Fotos de productos (Supabase Storage). */
  productImages: ProductImageStorage;
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
          <ProductImageStorageContext.Provider value={services.productImages}>
            <AuthProvider services={services}>{children}</AuthProvider>
          </ProductImageStorageContext.Provider>
        </CatalogReaderContext.Provider>
      </ApiContext.Provider>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
