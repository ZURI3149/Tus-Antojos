import { describe, expect, it } from 'vitest';
import { categorySchema, ingredientSchema, productSchema } from './catalog.schema';
import { toCategory, toIngredient, toProduct } from './mappers';

const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const stamps = { created_at: '2026-11-17 10:00:00+00', updated_at: '2026-11-17T11:00:00+00:00' };

describe('mappers del catálogo', () => {
  it('toCategory', () => {
    const category = toCategory({ id, name: 'Helados', sort_order: 2, is_active: true, ...stamps });
    expect(category).toEqual({
      id,
      name: 'Helados',
      sortOrder: 2,
      isActive: true,
      createdAt: '2026-11-17T10:00:00.000Z',
      updatedAt: '2026-11-17T11:00:00.000Z',
    });
    expect(categorySchema.parse(category)).toEqual(category);
  });

  it('toIngredient', () => {
    const ingredient = toIngredient({ id, name: 'Leche', unit: 'ml', is_active: false, ...stamps });
    expect(ingredient).toMatchObject({ unit: 'ml', isActive: false });
    expect(ingredientSchema.parse(ingredient)).toEqual(ingredient);
  });

  it('toProduct con y sin receta', () => {
    const row = {
      id,
      category_id: other,
      name: 'Cono',
      description: '',
      price_cents: 1250,
      image_path: null,
      is_active: true,
      ...stamps,
    };
    expect(toProduct(row).recipe).toEqual([]);
    const product = toProduct({ ...row, recipe_items: [{ ingredient_id: other, quantity: 150 }] });
    expect(product).toMatchObject({
      categoryId: other,
      priceCents: 1250,
      imagePath: null,
      recipe: [{ ingredientId: other, quantity: 150 }],
    });
    expect(productSchema.parse(product)).toEqual(product);
  });
});
