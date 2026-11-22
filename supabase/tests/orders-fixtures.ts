import { sql } from './helpers.js';

export function ordersFixtures(label: string) {
  const prefix = `zz-ord-${label}-${crypto.randomUUID().slice(0, 8)}-`;
  let counter = 0;
  const name = (base: string) => `${prefix}${base}-${++counter}`;

  async function category(): Promise<string> {
    const [row] = await sql<{ id: string }>(
      `insert into public.categories (name, is_active) values ($1, true) returning id`,
      [name('cat')],
    );
    return row!.id;
  }

  async function ingredient(initialStock = 1000): Promise<string> {
    const [row] = await sql<{ id: string }>(
      `insert into public.ingredients (name, unit, is_active) values ($1, 'unidad', true) returning id`,
      [name('ing')],
    );
    const id = row!.id;
    if (initialStock > 0) {
      await sql(
        `update public.inventory_stock set quantity = $1, avg_unit_cost = 10 where ingredient_id = $2`,
        [initialStock, id],
      );
    }
    return id;
  }

  async function product(
    categoryId: string,
    opts: {
      priceCents?: number;
      active?: boolean;
      recipe?: { ingredientId: string; quantity: number }[];
    } = {},
  ): Promise<{ id: string; ingredientId: string }> {
    const shouldBeActive = opts.active ?? true;
    const [row] = await sql<{ id: string }>(
      `insert into public.products (category_id, name, price_cents, is_active) values ($1, $2, $3, false) returning id`,
      [categoryId, name('prod'), opts.priceCents ?? 2500],
    );
    const id = row!.id;

    let mainIngId: string;
    if (opts.recipe && opts.recipe.length > 0) {
      for (const r of opts.recipe) {
        await sql(
          `insert into public.recipe_items (product_id, ingredient_id, quantity) values ($1, $2, $3)`,
          [id, r.ingredientId, r.quantity],
        );
      }
      mainIngId = opts.recipe[0]!.ingredientId;
    } else {
      mainIngId = await ingredient();
      await sql(
        `insert into public.recipe_items (product_id, ingredient_id, quantity) values ($1, $2, 2)`,
        [id, mainIngId],
      );
    }

    if (shouldBeActive) {
      await sql(`update public.products set is_active = true where id = $1`, [id]);
    }

    return { id, ingredientId: mainIngId };
  }

  async function promotion(
    productId: string,
    value = 20,
    kind: 'porcentaje' | 'monto_fijo' = 'porcentaje',
  ): Promise<string> {
    const [row] = await sql<{ id: string }>(
      `insert into public.promotions (name, kind, value, starts_at, ends_at, is_active)
       values ($1, $2, $3, now() - interval '1 hour', now() + interval '1 hour', true) returning id`,
      [name('promo'), kind, value],
    );
    const id = row!.id;
    await sql(`insert into public.promotion_products (promotion_id, product_id) values ($1, $2)`, [
      id,
      productId,
    ]);
    return id;
  }

  async function cleanup(): Promise<void> {
    const like = `${prefix}%`;
    const orderRows = await sql<{ id: string }>(
      `select distinct o.id from public.orders o
       join public.order_items oi on oi.order_id = o.id
       join public.products p on p.id = oi.product_id
       where p.name like $1`,
      [like],
    );
    if (orderRows.length > 0) {
      const oids = orderRows.map((r) => r.id);
      await sql(`delete from public.inventory_movements where order_id = any($1)`, [oids]);
      await sql(`delete from public.order_events where order_id = any($1)`, [oids]);
      await sql(`delete from public.order_items where order_id = any($1)`, [oids]);
      await sql(`delete from public.orders where id = any($1)`, [oids]);
    }

    await sql(`delete from public.promotions where name like $1`, [like]);
    await sql(`delete from public.products where name like $1`, [like]);
    await sql(
      `delete from public.inventory_stock
       where ingredient_id in (select id from public.ingredients where name like $1)`,
      [like],
    );
    await sql(`delete from public.ingredients where name like $1`, [like]);
    await sql(`delete from public.categories where name like $1`, [like]);
  }

  return { name, category, ingredient, product, promotion, cleanup };
}
