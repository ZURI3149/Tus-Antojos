import { sql } from './helpers.js';

export function promotionsFixtures(label: string) {
  const prefix = `zz-pr-${label}-${crypto.randomUUID().slice(0, 8)}-`;
  let counter = 0;
  const name = (base: string) => `${prefix}${base}-${++counter}`;

  async function category(): Promise<string> {
    const [row] = await sql<{ id: string }>(
      `insert into public.categories (name, is_active) values ($1, true) returning id`,
      [name('cat')],
    );
    return row!.id;
  }

  async function ingredient(): Promise<string> {
    const [row] = await sql<{ id: string }>(
      `insert into public.ingredients (name, unit, is_active) values ($1, 'unidad', true) returning id`,
      [name('ing')],
    );
    return row!.id;
  }

  async function product(
    categoryId: string,
    opts: { priceCents?: number; active?: boolean } = {},
  ): Promise<string> {
    const shouldBeActive = opts.active ?? true;
    const [row] = await sql<{ id: string }>(
      `insert into public.products (category_id, name, price_cents, is_active) values ($1, $2, $3, false) returning id`,
      [categoryId, name('prod'), opts.priceCents ?? 2500],
    );
    const id = row!.id;
    if (shouldBeActive) {
      const ingId = await ingredient();
      await sql(
        `insert into public.recipe_items (product_id, ingredient_id, quantity) values ($1, $2, 1)`,
        [id, ingId],
      );
      await sql(`update public.products set is_active = true where id = $1`, [id]);
    }
    return id;
  }

  async function promotion(
    opts: {
      name?: string;
      kind?: 'porcentaje' | 'monto_fijo';
      value?: number;
      startsAt?: string;
      endsAt?: string | null;
      isActive?: boolean;
      productIds?: string[];
    } = {},
  ): Promise<string> {
    const promoName = opts.name ?? name('promo');
    const [row] = await sql<{ id: string }>(
      `insert into public.promotions (name, kind, value, starts_at, ends_at, is_active)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [
        promoName,
        opts.kind ?? 'porcentaje',
        opts.value ?? 20,
        opts.startsAt ?? '2026-11-20T00:00:00-04:00',
        opts.endsAt ?? null,
        opts.isActive ?? true,
      ],
    );
    const id = row!.id;
    for (const pid of opts.productIds ?? []) {
      await sql(
        `insert into public.promotion_products (promotion_id, product_id) values ($1, $2)`,
        [id, pid],
      );
    }
    return id;
  }

  async function cleanup(): Promise<void> {
    const like = `${prefix}%`;
    await sql(`delete from public.promotions where name like $1`, [like]);
    await sql(`delete from public.products where name like $1`, [like]);
    await sql(`delete from public.ingredients where name like $1`, [like]);
    await sql(`delete from public.categories where name like $1`, [like]);
  }

  return { prefix, name, category, ingredient, product, promotion, cleanup };
}
