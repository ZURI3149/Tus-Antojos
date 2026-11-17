import type { SupabaseClient } from '@supabase/supabase-js';
import {
  toCategory,
  toIngredient,
  toProduct,
  type Category,
  type Database,
  type Ingredient,
  type Product,
} from '@tus-antojos/shared';
import { createContext, useContext } from 'react';

/**
 * Lecturas del catálogo. Van directo a Supabase con la sesión del usuario: la RLS
 * decide qué filas ve (cajero y cocina, solo las activas). Las escrituras van por la API.
 * Es una interfaz para poder reemplazarla en las pruebas (test/fake-catalog.ts).
 */
export interface CatalogReader {
  categories(): Promise<Category[]>;
  ingredients(): Promise<Ingredient[]>;
  /** Productos con su receta. */
  products(): Promise<Product[]>;
}

function unwrap<T>(result: { data: T | null; error: unknown }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`No se pudo cargar ${what}`, { cause: result.error });
  }
  return result.data;
}

export function createSupabaseCatalogReader(db: SupabaseClient<Database>): CatalogReader {
  return {
    async categories() {
      const result = await db.from('categories').select('*').order('sort_order').order('name');
      return unwrap(result, 'las categorías').map(toCategory);
    },
    async ingredients() {
      const result = await db.from('ingredients').select('*').order('name');
      return unwrap(result, 'los insumos').map(toIngredient);
    },
    async products() {
      const result = await db
        .from('products')
        .select('*, recipe_items(ingredient_id, quantity)')
        .order('name');
      return unwrap(result, 'los productos').map(toProduct);
    },
  };
}

export const CatalogReaderContext = createContext<CatalogReader | null>(null);

export function useCatalogReader(): CatalogReader {
  const reader = useContext(CatalogReaderContext);
  if (!reader) throw new Error('useCatalogReader() debe usarse dentro de <AppProviders>');
  return reader;
}
