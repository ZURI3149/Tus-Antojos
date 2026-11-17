import { describe, expect, it } from 'vitest';
import {
  confirmProductImageSchema,
  createCategorySchema,
  createIngredientSchema,
  createProductSchema,
  setRecipeSchema,
  updateCategorySchema,
  updateIngredientSchema,
  updateProductSchema,
} from './catalog.schema';
import { CATALOG_RULE_MESSAGES, CATALOG_RULES, catalogRuleMessage } from './rules';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((i) => i.message) ?? [];
}

describe('nombres del catálogo', () => {
  it('recorta espacios y exige 1..80 caracteres', () => {
    expect(createCategorySchema.parse({ name: '  Helados  ' }).name).toBe('Helados');
    expect(messages(createCategorySchema.safeParse({ name: '   ' }))).toContain(
      'Ingresa el nombre',
    );
    expect(messages(createCategorySchema.safeParse({ name: 'x'.repeat(81) }))).toContain(
      'Máximo 80 caracteres',
    );
  });
});

describe('categorías', () => {
  it('aplica valores por defecto', () => {
    expect(createCategorySchema.parse({ name: 'Bebidas' })).toEqual({
      name: 'Bebidas',
      sortOrder: 0,
      isActive: true,
    });
  });

  it('limita el orden a un entero de 0 a 9999', () => {
    expect(createCategorySchema.safeParse({ name: 'A', sortOrder: -1 }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'A', sortOrder: 1.5 }).success).toBe(false);
    expect(createCategorySchema.safeParse({ name: 'A', sortOrder: 10_000 }).success).toBe(false);
  });

  it('la edición exige al menos un cambio y no acepta campos extra', () => {
    expect(messages(updateCategorySchema.safeParse({}))).toContain('Indica al menos un cambio');
    expect(updateCategorySchema.safeParse({ name: 'A', id: uuid(1) }).success).toBe(false);
    expect(updateCategorySchema.parse({ isActive: false })).toEqual({ isActive: false });
  });
});

describe('insumos', () => {
  it('solo acepta unidades base', () => {
    expect(createIngredientSchema.parse({ name: 'Harina', unit: 'g' })).toEqual({
      name: 'Harina',
      unit: 'g',
      isActive: true,
    });
    expect(createIngredientSchema.safeParse({ name: 'Harina', unit: 'kg' }).success).toBe(false);
  });

  it('la edición exige al menos un cambio', () => {
    expect(updateIngredientSchema.safeParse({}).success).toBe(false);
    expect(updateIngredientSchema.parse({ unit: 'ml' })).toEqual({ unit: 'ml' });
  });
});

describe('productos', () => {
  const base = { categoryId: uuid(1), name: 'Cono doble', priceCents: 1250 };

  it('crea inactivo, sin descripción y sin receta por defecto', () => {
    expect(createProductSchema.parse(base)).toEqual({
      ...base,
      description: '',
      isActive: false,
      recipe: [],
    });
  });

  it('exige precio entero positivo y con tope', () => {
    for (const priceCents of [0, -1, 12.5, 100_000_001]) {
      expect(createProductSchema.safeParse({ ...base, priceCents }).success).toBe(false);
    }
  });

  it('limita la descripción a 500 caracteres', () => {
    const description = 'x'.repeat(501);
    expect(messages(createProductSchema.safeParse({ ...base, description }))).toContain(
      'Máximo 500 caracteres',
    );
  });

  it('la edición acepta cambios parciales', () => {
    expect(updateProductSchema.parse({ priceCents: 1500 })).toEqual({ priceCents: 1500 });
    expect(updateProductSchema.safeParse({}).success).toBe(false);
    expect(updateProductSchema.safeParse({ recipe: [] }).success).toBe(false);
  });
});

describe('recetas', () => {
  it('acepta cantidades enteras positivas', () => {
    const items = [
      { ingredientId: uuid(1), quantity: 150 },
      { ingredientId: uuid(2), quantity: 1 },
    ];
    expect(setRecipeSchema.parse({ items })).toEqual({ items });
  });

  it('rechaza insumos repetidos', () => {
    const items = [
      { ingredientId: uuid(1), quantity: 1 },
      { ingredientId: uuid(1), quantity: 2 },
    ];
    expect(messages(setRecipeSchema.safeParse({ items }))).toContain(
      'Un insumo aparece dos veces en la receta',
    );
  });

  it.each([0, -5, 1.5, 1_000_001])('rechaza la cantidad %d', (quantity) => {
    expect(
      setRecipeSchema.safeParse({ items: [{ ingredientId: uuid(1), quantity }] }).success,
    ).toBe(false);
  });

  it('admite como máximo 30 insumos', () => {
    const items = Array.from({ length: 31 }, (_, i) => ({ ingredientId: uuid(i), quantity: 1 }));
    expect(setRecipeSchema.safeParse({ items }).success).toBe(false);
  });

  it('una receta vacía es válida (el producto quedará inactivo)', () => {
    expect(setRecipeSchema.parse({ items: [] })).toEqual({ items: [] });
  });
});

describe('foto del producto', () => {
  it('acepta solo paths de la carpeta de productos en WebP', () => {
    const path = `products/${uuid(1)}/${uuid(2)}.webp`;
    expect(confirmProductImageSchema.parse({ path })).toEqual({ path });
    for (const bad of [
      `products/${uuid(1)}/../x.webp`,
      `other/${uuid(1)}/${uuid(2)}.webp`,
      `products/${uuid(1)}/${uuid(2)}.png`,
      '',
    ]) {
      expect(confirmProductImageSchema.safeParse({ path: bad }).success).toBe(false);
    }
  });
});

describe('reglas del catálogo', () => {
  it('cada código tiene un mensaje en español', () => {
    for (const code of CATALOG_RULES) {
      expect(CATALOG_RULE_MESSAGES[code]).toMatch(/\S/);
    }
  });

  it('traduce códigos conocidos y deja pasar los desconocidos', () => {
    expect(catalogRuleMessage('PRODUCT_WITHOUT_RECIPE')).toBe(
      CATALOG_RULE_MESSAGES.PRODUCT_WITHOUT_RECIPE,
    );
    expect(catalogRuleMessage('OTRA_COSA')).toBeUndefined();
  });
});
