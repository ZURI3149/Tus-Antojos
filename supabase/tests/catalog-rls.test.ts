import { APP_ROLES, type AppRole } from '@tus-antojos/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { catalogFixtures } from './catalog-fixtures.js';
import { anonClient, closeSql, serviceClient, signedInClient, type Client } from './helpers.js';

// CA-04: ningún cliente escribe en el catálogo ni sube fotos sin URL firmada.
// CA-05: cajero y cocina leen solo lo activo; admin lee todo.

const PERMISSION_DENIED = '42501';
const BUCKET = 'product-images';
const TABLES = ['categories', 'products', 'ingredients', 'recipe_items'] as const;

type Actor = AppRole | 'anon';
const ACTORS: Actor[] = ['anon', ...APP_ROLES];

const fx = catalogFixtures('rls');
const clients = {} as Record<Actor, Client>;
const ids = {} as {
  activeCategory: string;
  inactiveCategory: string;
  activeIngredient: string;
  inactiveIngredient: string;
  activeProduct: string;
  inactiveProduct: string;
};

beforeAll(async () => {
  clients.anon = anonClient();
  for (const role of APP_ROLES) clients[role] = await signedInClient(role);

  ids.activeCategory = await fx.category();
  ids.inactiveCategory = await fx.category({ active: false });
  ids.activeIngredient = await fx.ingredient();
  ids.inactiveIngredient = await fx.ingredient({ active: false });
  ids.activeProduct = (
    await fx.product({
      categoryId: ids.activeCategory,
      recipe: [{ ingredientId: ids.activeIngredient, quantity: 10 }],
      active: true,
    })
  ).id;
  ids.inactiveProduct = (
    await fx.product({
      categoryId: ids.activeCategory,
      recipe: [{ ingredientId: ids.activeIngredient, quantity: 20 }],
    })
  ).id;
});

afterAll(async () => {
  await fx.cleanupCatalog();
  await closeSql();
});

describe('escrituras desde el cliente', () => {
  const rowFor = {
    categories: () => ({ name: fx.name('x') }),
    products: () => ({ category_id: ids.activeCategory, name: fx.name('x'), price_cents: 100 }),
    ingredients: () => ({ name: fx.name('x'), unit: 'g' as const }),
    recipe_items: () => ({
      product_id: ids.inactiveProduct,
      ingredient_id: ids.activeIngredient,
      quantity: 1,
    }),
  };

  describe.each(TABLES)('%s', (table) => {
    // Filtro que abarca todas las filas (recipe_items no tiene id ni created_at).
    const anyRow = (table === 'recipe_items' ? 'quantity' : 'id') as never;

    it.each(ACTORS)('%s no puede insertar', async (actor) => {
      const { error } = await clients[actor].from(table).insert(rowFor[table]() as never);
      expect(error?.code).toBe(PERMISSION_DENIED);
    });

    it.each(ACTORS)('%s no puede actualizar', async (actor) => {
      const column = table === 'recipe_items' ? { quantity: 99 } : { is_active: true };
      const { error } = await clients[actor]
        .from(table)
        .update(column as never)
        .not(anyRow, 'is', null);
      expect(error?.code).toBe(PERMISSION_DENIED);
    });

    it.each(ACTORS)('%s no puede borrar', async (actor) => {
      const { error } = await clients[actor].from(table).delete().not(anyRow, 'is', null);
      expect(error?.code).toBe(PERMISSION_DENIED);
    });
  });

  it.each(ACTORS)('%s no puede ejecutar los RPC del catálogo', async (actor) => {
    const create = await clients[actor].rpc('create_product', {
      p_category_id: ids.activeCategory,
      p_name: fx.name('rpc'),
      p_description: '',
      p_price_cents: 100,
      p_is_active: false,
    });
    expect(create.error?.code).toBe(PERMISSION_DENIED);

    const recipe = await clients[actor].rpc('set_product_recipe', {
      p_product_id: ids.activeProduct,
      p_items: [],
    });
    expect(recipe.error?.code).toBe(PERMISSION_DENIED);
  });
});

describe('lectura (RLS)', () => {
  async function visibleIds(actor: Actor, table: 'categories' | 'products' | 'ingredients') {
    const { data, error } = await clients[actor]
      .from(table)
      .select('id')
      .like('name', `${fx.prefix}%`);
    expect(error).toBeNull();
    return new Set(data!.map((r) => r.id));
  }

  it.each(TABLES)('anon no puede leer %s', async (table) => {
    const { error } = await clients.anon.from(table).select('*').limit(1);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(['cajero', 'cocina'] as const)('%s solo ve lo activo', async (role) => {
    expect(await visibleIds(role, 'categories')).toEqual(new Set([ids.activeCategory]));
    expect(await visibleIds(role, 'ingredients')).toEqual(new Set([ids.activeIngredient]));
    expect(await visibleIds(role, 'products')).toEqual(new Set([ids.activeProduct]));
  });

  it('admin ve también lo inactivo', async () => {
    expect(await visibleIds('admin', 'categories')).toEqual(
      new Set([ids.activeCategory, ids.inactiveCategory]),
    );
    expect(await visibleIds('admin', 'ingredients')).toEqual(
      new Set([ids.activeIngredient, ids.inactiveIngredient]),
    );
    expect(await visibleIds('admin', 'products')).toEqual(
      new Set([ids.activeProduct, ids.inactiveProduct]),
    );
  });

  it.each(['cajero', 'cocina'] as const)(
    '%s ve la receta de los productos activos y no la de los inactivos',
    async (role) => {
      const { data, error } = await clients[role]
        .from('recipe_items')
        .select('product_id, quantity')
        .in('product_id', [ids.activeProduct, ids.inactiveProduct]);
      expect(error).toBeNull();
      expect(data).toEqual([{ product_id: ids.activeProduct, quantity: 10 }]);
    },
  );

  it('admin ve las recetas de todos los productos', async () => {
    const { data } = await clients.admin
      .from('recipe_items')
      .select('product_id')
      .in('product_id', [ids.activeProduct, ids.inactiveProduct]);
    expect(new Set(data!.map((r) => r.product_id))).toEqual(
      new Set([ids.activeProduct, ids.inactiveProduct]),
    );
  });
});

describe('bucket product-images', () => {
  const service = () => serviceClient();
  const png = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
  const uploaded: string[] = [];
  const pathFor = () => `products/${ids.inactiveProduct}/${crypto.randomUUID()}.webp`;

  afterAll(async () => {
    if (uploaded.length > 0) await service().storage.from(BUCKET).remove(uploaded);
  });

  it.each(ACTORS)('%s no puede subir sin URL firmada', async (actor) => {
    const { error } = await clients[actor].storage
      .from(BUCKET)
      .upload(pathFor(), png(), { contentType: 'image/webp' });
    expect(error).not.toBeNull();
  });

  async function signedUpload(file: Blob, contentType: string) {
    const path = pathFor();
    const { data, error } = await service().storage.from(BUCKET).createSignedUploadUrl(path);
    expect(error).toBeNull();
    const result = await anonClient()
      .storage.from(BUCKET)
      .uploadToSignedUrl(path, data!.token, file, { contentType });
    if (!result.error) uploaded.push(path);
    return { path, error: result.error };
  }

  it('con la URL firmada de la API se sube y se lee por la URL pública', async () => {
    const { path, error } = await signedUpload(png(), 'image/webp');
    expect(error).toBeNull();
    const url = service().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const response = await fetch(url);
    expect(response.status).toBe(200);
  });

  it('rechaza archivos de más de 2 MB aunque tengan URL firmada', async () => {
    const big = new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'image/webp' });
    const { error } = await signedUpload(big, 'image/webp');
    expect(error).not.toBeNull();
  });

  it('rechaza tipos que no son imagen aunque tengan URL firmada', async () => {
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    const { error } = await signedUpload(pdf, 'application/pdf');
    expect(error).not.toBeNull();
  });
});
