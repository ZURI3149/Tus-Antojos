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

interface RecipeRowWithName {
  ingredient_id: string;
  quantity: number;
  ingredients: { name: string } | null;
}

/**
 * La BD no guarda un orden de la receta y sin `order` devuelve las filas en un orden arbitrario
 * (en la práctica, el de los UUID). Se muestran por nombre del insumo: estable y legible.
 */
export function sortRecipeRows<T extends RecipeRowWithName>(rows: T[] | undefined): T[] {
  return [...(rows ?? [])].sort((a, b) => {
    const an = a.ingredients?.name;
    const bn = b.ingredients?.name;
    if (an && bn) return an.localeCompare(bn, 'es', { sensitivity: 'base' });
    if (an) return -1;
    if (bn) return 1;
    return a.ingredient_id.localeCompare(b.ingredient_id);
  });
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
        .select('*, recipe_items(ingredient_id, quantity, ingredients(name))')
        .order('name');
      return unwrap(result, 'los productos').map((row) =>
        toProduct({ ...row, recipe_items: sortRecipeRows(row.recipe_items) }),
      );
    },
  };
}

export const CatalogReaderContext = createContext<CatalogReader | null>(null);

export function useCatalogReader(): CatalogReader {
  const reader = useContext(CatalogReaderContext);
  if (!reader) throw new Error('useCatalogReader() debe usarse dentro de <AppProviders>');
  return reader;
}
