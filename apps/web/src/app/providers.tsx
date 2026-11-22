import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import type { AuthServices } from '@/features/auth/auth-context';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ProductImageStorageContext, type ProductImageStorage } from '@/features/catalog/images';
import { CatalogReaderContext, type CatalogReader } from '@/features/catalog/reader';
import { InventoryReaderContext, type InventoryReader } from '@/features/inventory/reader';
import { OrdersReaderContext, type OrdersReader } from '@/features/pos/reader';
import { PromotionsReaderContext, type PromotionsReader } from '@/features/promotions/reader';
import type { ApiClient } from '@/lib/api-client';
import { ApiContext } from '@/lib/api-context';
import type { Outbox } from '@/lib/offline/outbox';
import type { SnapshotStore } from '@/lib/offline/snapshots';
import { createQueryClient } from '@/lib/query-client';
import { OutboxProvider } from './OutboxProvider';
import { SnapshotsContext } from './snapshots-context';

/** Dependencias externas de la app (reales en main.tsx, falsas en pruebas). */
export interface AppServices extends AuthServices {
  api: ApiClient;
  /** Lecturas del catálogo (Supabase + RLS). */
  catalog: CatalogReader;
  /** Fotos de productos (Supabase Storage). */
  productImages: ProductImageStorage;
  /** Lecturas de inventario (Supabase + RLS). */
  inventory: InventoryReader;
  /** Lecturas de promociones (Supabase + RLS). */
  promotions: PromotionsReader;
  /** Lecturas de pedidos (Supabase + RLS). */
  orders: OrdersReader;
  /** Cola de pedidos cobrados sin conexión (IndexedDB). */
  outbox: Outbox;
  /** Última lectura del catálogo para la caja sin red (IndexedDB). */
  snapshots: SnapshotStore;
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
            <InventoryReaderContext.Provider value={services.inventory}>
              <PromotionsReaderContext.Provider value={services.promotions}>
                <OrdersReaderContext.Provider value={services.orders}>
                  <SnapshotsContext.Provider value={services.snapshots}>
                    <AuthProvider services={services}>
                      <OutboxProvider outbox={services.outbox}>{children}</OutboxProvider>
                    </AuthProvider>
                  </SnapshotsContext.Provider>
                </OrdersReaderContext.Provider>
              </PromotionsReaderContext.Provider>
            </InventoryReaderContext.Provider>
          </ProductImageStorageContext.Provider>
        </CatalogReaderContext.Provider>
      </ApiContext.Provider>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
