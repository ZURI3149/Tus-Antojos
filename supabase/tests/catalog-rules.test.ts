import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { catalogFixtures } from './catalog-fixtures.js';
import { closeSql, serviceClient, sql, type Client } from './helpers.js';

// Reglas del catálogo (spec catalog §3.1) y atomicidad de sus RPC (CA-06).
// Se escribe con service_role, como lo hará NestJS.

const fx = catalogFixtures('rules');
let service: Client;

beforeAll(() => {
  service = serviceClient();
});

afterAll(async () => {
  await fx.cleanupCatalog();
  await closeSql();
});

async function productCount(name: string): Promise<number> {
  const rows = await sql<{ n: string }>(
    `select count(*) as n from public.products where name = $1`,
    [name],
  );
  return Number(rows[0]!.n);
}

async function recipeOf(productId: string) {
  return sql<{ ingredient_id: string; quantity: number }>(
    `select ingredient_id, quantity from public.recipe_items where product_id = $1 order by quantity`,
    [productId],
  );
}

function createProduct(args: {
  categoryId: string;
  name: string;
  isActive: boolean;
  recipe: { ingredient_id: string; quantity: number }[];
}) {
  return service.rpc('create_product', {
    p_category_id: args.categoryId,
    p_name: args.name,
    p_description: '',
    p_price_cents: 1250,
    p_is_active: args.isActive,
    p_recipe: args.recipe,
  });
}

describe('create_product', () => {
  it('crea un producto activo con su receta en una sola llamada', async () => {
    const categoryId = await fx.category();
    const [a, b] = [await fx.ingredient(), await fx.ingredient({ unit: 'ml' })];
    const name = fx.name('ok');

    const { data: id, error } = await createProduct({
      categoryId,
      name,
      isActive: true,
      recipe: [
        { ingredient_id: a, quantity: 150 },
        { ingredient_id: b, quantity: 200 },
      ],
    });

    expect(error).toBeNull();
    expect(await recipeOf(id!)).toEqual([
      { ingredient_id: a, quantity: 150 },
      { ingredient_id: b, quantity: 200 },
    ]);
    const [row] = await sql(`select is_active, price_cents from public.products where id = $1`, [
      id,
    ]);
    expect(row).toEqual({ is_active: true, price_cents: 1250 });
  });

  it('puede crear un producto inactivo sin receta', async () => {
    const { error } = await createProduct({
      categoryId: await fx.category(),
      name: fx.name('draft'),
      isActive: false,
      recipe: [],
    });
    expect(error).toBeNull();
  });

  it('PRODUCT_WITHOUT_RECIPE: activo sin receta no deja nada creado', async () => {
    const name = fx.name('norecipe');
    const { error } = await createProduct({
      categoryId: await fx.category(),
      name,
      isActive: true,
      recipe: [],
    });
    expect(error).toMatchObject({ code: 'P0001', message: 'PRODUCT_WITHOUT_RECIPE' });
    expect(await productCount(name)).toBe(0);
  });

  it('INGREDIENT_INACTIVE: no deja ni el producto ni las líneas válidas', async () => {
    const name = fx.name('inactive-ing');
    const { error } = await createProduct({
      categoryId: await fx.category(),
      name,
      isActive: false,
      recipe: [
        { ingredient_id: await fx.ingredient(), quantity: 1 },
        { ingredient_id: await fx.ingredient({ active: false }), quantity: 2 },
      ],
    });
    expect(error).toMatchObject({ code: 'P0001', message: 'INGREDIENT_INACTIVE' });
    expect(await productCount(name)).toBe(0);
  });

  it('CATEGORY_INACTIVE: no se crea activo en una categoría inactiva', async () => {
    const name = fx.name('inactive-cat');
    const { error } = await createProduct({
      categoryId: await fx.category({ active: false }),
      name,
      isActive: true,
      recipe: [{ ingredient_id: await fx.ingredient(), quantity: 1 }],
    });
    expect(error).toMatchObject({ code: 'P0001', message: 'CATEGORY_INACTIVE' });
    expect(await productCount(name)).toBe(0);
  });

  it('un insumo inexistente falla por clave foránea y no deja nada', async () => {
    const name = fx.name('ghost');
    const { error } = await createProduct({
      categoryId: await fx.category(),
      name,
      isActive: false,
      recipe: [{ ingredient_id: crypto.randomUUID(), quantity: 1 }],
    });
    expect(error?.code).toBe('23503');
    expect(await productCount(name)).toBe(0);
  });

  it('un nombre repetido (sin distinguir mayúsculas) falla con 23505', async () => {
    const categoryId = await fx.category();
    const name = fx.name('Dup');
    expect(
      (await createProduct({ categoryId, name, isActive: false, recipe: [] })).error,
    ).toBeNull();
    const { error } = await createProduct({
      categoryId,
      name: name.toUpperCase(),
      isActive: false,
      recipe: [],
    });
    expect(error?.code).toBe('23505');
  });
});

describe('set_product_recipe', () => {
  it('reemplaza la receta completa', async () => {
    const [a, b, c] = [await fx.ingredient(), await fx.ingredient(), await fx.ingredient()];
    const product = await fx.product({
      categoryId: await fx.category(),
      recipe: [
        { ingredientId: a, quantity: 1 },
        { ingredientId: b, quantity: 2 },
      ],
      active: true,
    });

    const { error } = await service.rpc('set_product_recipe', {
      p_product_id: product.id,
      p_items: [{ ingredient_id: c, quantity: 30 }],
    });

    expect(error).toBeNull();
    expect(await recipeOf(product.id)).toEqual([{ ingredient_id: c, quantity: 30 }]);
  });

  it('PRODUCT_WITHOUT_RECIPE: vaciar la receta de un producto activo no cambia nada', async () => {
    const a = await fx.ingredient();
    const product = await fx.product({
      categoryId: await fx.category(),
      recipe: [{ ingredientId: a, quantity: 5 }],
      active: true,
    });

    const { error } = await service.rpc('set_product_recipe', {
      p_product_id: product.id,
      p_items: [],
    });

    expect(error).toMatchObject({ code: 'P0001', message: 'PRODUCT_WITHOUT_RECIPE' });
    expect(await recipeOf(product.id)).toEqual([{ ingredient_id: a, quantity: 5 }]);
  });

  it('un producto inactivo puede quedar sin receta', async () => {
    const product = await fx.product({
      categoryId: await fx.category(),
      recipe: [{ ingredientId: await fx.ingredient(), quantity: 5 }],
    });
    const { error } = await service.rpc('set_product_recipe', {
      p_product_id: product.id,
      p_items: [],
    });
    expect(error).toBeNull();
    expect(await recipeOf(product.id)).toEqual([]);
  });

  it('PRODUCT_NOT_FOUND con un id inexistente', async () => {
    const { error } = await service.rpc('set_product_recipe', {
      p_product_id: crypto.randomUUID(),
      p_items: [],
    });
    expect(error).toMatchObject({ code: 'P0001', message: 'PRODUCT_NOT_FOUND' });
  });

  it('INGREDIENT_INACTIVE: no agrega insumos inactivos y conserva la receta anterior', async () => {
    const a = await fx.ingredient();
    const product = await fx.product({
      categoryId: await fx.category(),
      recipe: [{ ingredientId: a, quantity: 5 }],
    });
    const { error } = await service.rpc('set_product_recipe', {
      p_product_id: product.id,
      p_items: [{ ingredient_id: await fx.ingredient({ active: false }), quantity: 1 }],
    });
    expect(error).toMatchObject({ code: 'P0001', message: 'INGREDIENT_INACTIVE' });
    expect(await recipeOf(product.id)).toEqual([{ ingredient_id: a, quantity: 5 }]);
  });
});

describe('activar un producto (escritura directa, como PATCH /products/:id)', () => {
  it('PRODUCT_WITHOUT_RECIPE sin receta', async () => {
    const product = await fx.product({ categoryId: await fx.category() });
    const { error } = await service
      .from('products')
      .update({ is_active: true })
      .eq('id', product.id);
    expect(error).toMatchObject({ code: 'P0001', message: 'PRODUCT_WITHOUT_RECIPE' });
  });

  it('se activa con receta y categoría activas', async () => {
    const product = await fx.product({
      categoryId: await fx.category(),
      recipe: [{ ingredientId: await fx.ingredient(), quantity: 1 }],
    });
    const { error } = await service
      .from('products')
      .update({ is_active: true })
      .eq('id', product.id);
    expect(error).toBeNull();
  });

  it('CATEGORY_INACTIVE al mover un producto activo a una categoría inactiva', async () => {
    const product = await fx.product({
      categoryId: await fx.category(),
      recipe: [{ ingredientId: await fx.ingredient(), quantity: 1 }],
      active: true,
    });
    const { error } = await service
      .from('products')
      .update({ category_id: await fx.category({ active: false }) })
      .eq('id', product.id);
    expect(error).toMatchObject({ code: 'P0001', message: 'CATEGORY_INACTIVE' });
  });
});

describe('desactivar insumos y categorías', () => {
  it('INGREDIENT_IN_USE: indica qué productos activos lo usan', async () => {
    const ingredientId = await fx.ingredient();
    const categoryId = await fx.category();
    const used = await fx.product({
      categoryId,
      recipe: [{ ingredientId, quantity: 1 }],
      active: true,
    });
    await fx.product({ categoryId, recipe: [{ ingredientId, quantity: 1 }] }); // inactivo

    const { error } = await service
      .from('ingredients')
      .update({ is_active: false })
      .eq('id', ingredientId);

    expect(error).toMatchObject({ code: 'P0001', message: 'INGREDIENT_IN_USE' });
    expect(JSON.parse(error!.details)).toEqual({ products: [used.name] });
  });

  it('un insumo usado solo por productos inactivos se puede desactivar', async () => {
    const ingredientId = await fx.ingredient();
    await fx.product({ categoryId: await fx.category(), recipe: [{ ingredientId, quantity: 1 }] });
    const { error } = await service
      .from('ingredients')
      .update({ is_active: false })
      .eq('id', ingredientId);
    expect(error).toBeNull();
  });

  it('CATEGORY_IN_USE: indica cuántos productos activos tiene', async () => {
    const categoryId = await fx.category();
    await fx.product({
      categoryId,
      recipe: [{ ingredientId: await fx.ingredient(), quantity: 1 }],
      active: true,
    });
    const { error } = await service
      .from('categories')
      .update({ is_active: false })
      .eq('id', categoryId);
    expect(error).toMatchObject({ code: 'P0001', message: 'CATEGORY_IN_USE' });
    expect(JSON.parse(error!.details)).toEqual({ activeProducts: 1 });
  });

  it('una categoría sin productos activos se puede desactivar', async () => {
    const categoryId = await fx.category();
    await fx.product({ categoryId });
    const { error } = await service
      .from('categories')
      .update({ is_active: false })
      .eq('id', categoryId);
    expect(error).toBeNull();
  });
});

describe('unidad de los insumos', () => {
  it('INGREDIENT_UNIT_LOCKED si el insumo está en una receta', async () => {
    const ingredientId = await fx.ingredient({ unit: 'g' });
    await fx.product({ categoryId: await fx.category(), recipe: [{ ingredientId, quantity: 1 }] });
    const { error } = await service
      .from('ingredients')
      .update({ unit: 'ml' })
      .eq('id', ingredientId);
    expect(error).toMatchObject({ code: 'P0001', message: 'INGREDIENT_UNIT_LOCKED' });
  });

  it('se puede cambiar si no está en ninguna receta', async () => {
    const ingredientId = await fx.ingredient({ unit: 'g' });
    const { error } = await service
      .from('ingredients')
      .update({ unit: 'ml' })
      .eq('id', ingredientId);
    expect(error).toBeNull();
  });
});

describe('restricciones de las tablas', () => {
  it('la foto debe estar en la carpeta del propio producto', async () => {
    const categoryId = await fx.category();
    const product = await fx.product({ categoryId });
    const other = await fx.product({ categoryId });

    const own = `products/${product.id}/${crypto.randomUUID()}.webp`;
    const foreign = `products/${other.id}/${crypto.randomUUID()}.webp`;

    const ok = await service.from('products').update({ image_path: own }).eq('id', product.id);
    expect(ok.error).toBeNull();
    const bad = await service.from('products').update({ image_path: foreign }).eq('id', product.id);
    expect(bad.error?.code).toBe('23514');
  });

  it('nombres de categorías e insumos únicos sin distinguir mayúsculas', async () => {
    const name = fx.name('Helados');
    expect((await service.from('categories').insert({ name })).error).toBeNull();
    const dup = await service.from('categories').insert({ name: name.toUpperCase() });
    expect(dup.error?.code).toBe('23505');

    const ing = fx.name('Leche');
    expect((await service.from('ingredients').insert({ name: ing, unit: 'ml' })).error).toBeNull();
    const dupIng = await service
      .from('ingredients')
      .insert({ name: ing.toLowerCase(), unit: 'ml' });
    expect(dupIng.error?.code).toBe('23505');
  });

  it('updated_at se actualiza solo', async () => {
    const id = await fx.category();
    const [before] = await sql<{ updated_at: Date }>(
      `select updated_at from public.categories where id = $1`,
      [id],
    );
    await sql(`update public.categories set sort_order = 5 where id = $1`, [id]);
    const [after] = await sql<{ updated_at: Date }>(
      `select updated_at from public.categories where id = $1`,
      [id],
    );
    expect(after!.updated_at.getTime()).toBeGreaterThan(before!.updated_at.getTime());
  });
});
