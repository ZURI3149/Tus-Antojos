import { sql } from './helpers.js';

/**
 * Datos de prueba del catálogo, creados directamente como `postgres`.
 * Todos los nombres llevan un prefijo propio de la ejecución para no chocar con el
 * seed ni entre archivos, y `cleanupCatalog()` borra solo lo que lleva ese prefijo.
 */
export function catalogFixtures(label: string) {
  const prefix = `zz-${label}-${crypto.randomUUID().slice(0, 8)}-`;
  let counter = 0;
  const name = (base: string) => `${prefix}${base}-${++counter}`;

  async function category(opts: { active?: boolean } = {}): Promise<string> {
    const [row] = await sql<{ id: string }>(
      `insert into public.categories (name, is_active) values ($1, $2) returning id`,
      [name('cat'), opts.active ?? true],
    );
    return row!.id;
  }

  async function ingredient(
    opts: { active?: boolean; unit?: 'g' | 'ml' | 'unidad' } = {},
  ): Promise<string> {
    const [row] = await sql<{ id: string }>(
      `insert into public.ingredients (name, unit, is_active) values ($1, $2, $3) returning id`,
      [name('ing'), opts.unit ?? 'g', opts.active ?? true],
    );
    return row!.id;
  }

  /** Crea el producto inactivo, le pone la receta y, si se pide, lo activa al final. */
  async function product(opts: {
    categoryId: string;
    recipe?: { ingredientId: string; quantity: number }[];
    active?: boolean;
  }): Promise<{ id: string; name: string }> {
    const productName = name('prod');
    const [row] = await sql<{ id: string }>(
      `insert into public.products (category_id, name, price_cents) values ($1, $2, 1000) returning id`,
      [opts.categoryId, productName],
    );
    const id = row!.id;
    for (const item of opts.recipe ?? []) {
      await sql(
        `insert into public.recipe_items (product_id, ingredient_id, quantity) values ($1, $2, $3)`,
        [id, item.ingredientId, item.quantity],
      );
    }
    if (opts.active) await sql(`update public.products set is_active = true where id = $1`, [id]);
    return { id, name: productName };
  }

  async function cleanupCatalog(): Promise<void> {
    const like = `${prefix}%`;
    // Productos primero (sus líneas de receta caen en cascada), luego lo que referencian.
    await sql(`delete from public.products where name like $1`, [like]);
    await sql(
      `delete from public.inventory_stock where ingredient_id in (select id from public.ingredients where name like $1)`,
      [like],
    );
    await sql(`delete from public.ingredients where name like $1`, [like]);
    await sql(`delete from public.categories where name like $1`, [like]);
  }

  return { prefix, name, category, ingredient, product, cleanupCatalog };
}
