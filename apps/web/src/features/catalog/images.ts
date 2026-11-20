import type { SupabaseClient } from '@supabase/supabase-js';
import { PRODUCT_IMAGE_BUCKET, type Database, type ProductImageUpload } from '@tus-antojos/shared';
import { createContext, useContext } from 'react';

/**
 * Fotos de productos en Supabase Storage. Leer es público; subir solo se puede con la
 * URL firmada que emite la API. Interfaz para reemplazarla en las pruebas.
 */
export interface ProductImageStorage {
  publicUrl(path: string): string;
  upload(target: ProductImageUpload, file: Blob): Promise<void>;
}

export function createSupabaseProductImageStorage(
  db: SupabaseClient<Database>,
): ProductImageStorage {
  const bucket = () => db.storage.from(PRODUCT_IMAGE_BUCKET);
  return {
    publicUrl: (path) => bucket().getPublicUrl(path).data.publicUrl,
    async upload(target, file) {
      const { error } = await bucket().uploadToSignedUrl(target.path, target.token, file, {
        contentType: file.type,
      });
      if (error) throw new Error('No se pudo subir la foto', { cause: error });
    },
  };
}

export const ProductImageStorageContext = createContext<ProductImageStorage | null>(null);

export function useProductImageStorage(): ProductImageStorage {
  const storage = useContext(ProductImageStorageContext);
  if (!storage) throw new Error('useProductImageStorage() debe usarse dentro de <AppProviders>');
  return storage;
}
