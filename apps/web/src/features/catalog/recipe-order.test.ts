import { describe, expect, it } from 'vitest';
import { sortRecipeRows } from './reader';

describe('sortRecipeRows', () => {
  it('ordena la receta por nombre del insumo, no por su id (que es aleatorio)', () => {
    const rows = [
      { ingredient_id: '0000-a', quantity: 200, ingredients: { name: 'Leche' } },
      { ingredient_id: 'ffff-z', quantity: 250, ingredients: { name: 'Harina' } },
      { ingredient_id: '8888-m', quantity: 10, ingredients: { name: 'azúcar' } },
    ];

    expect(sortRecipeRows(rows).map((r) => r.ingredients?.name)).toEqual([
      'azúcar',
      'Harina',
      'Leche',
    ]);
  });

  it('los insumos sin nombre visible (p. ej. ocultos por RLS) van al final, ordenados por id', () => {
    const rows = [
      { ingredient_id: 'b', quantity: 1, ingredients: null },
      { ingredient_id: 'a', quantity: 1, ingredients: null },
      { ingredient_id: 'c', quantity: 1, ingredients: { name: 'Crema' } },
    ];

    expect(sortRecipeRows(rows).map((r) => r.ingredient_id)).toEqual(['c', 'a', 'b']);
  });

  it('sin receta devuelve una lista vacía', () => {
    expect(sortRecipeRows(undefined)).toEqual([]);
  });
});
