import type { Tables } from '../db';
import type { Category, Ingredient, Product, RecipeItem } from './catalog.schema';

/**
 * Filas de la BD (snake_case) → objetos de la API (camelCase).
 * Los usan la API (respuestas) y la web (lecturas directas con Supabase).
 */

const iso = (value: string) => new Date(value).toISOString();

export function toCategory(row: Tables<'categories'>): Category {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toIngredient(row: Tables<'ingredients'>): Ingredient {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    isActive: row.is_active,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

type RecipeRow = Pick<Tables<'recipe_items'>, 'ingredient_id' | 'quantity'>;

export function toProduct(row: Tables<'products'> & { recipe_items?: RecipeRow[] }): Product {
  const recipe: RecipeItem[] = (row.recipe_items ?? []).map((item) => ({
    ingredientId: item.ingredient_id,
    quantity: item.quantity,
  }));
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    imagePath: row.image_path,
    isActive: row.is_active,
    recipe,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}
