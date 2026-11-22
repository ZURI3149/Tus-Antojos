import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pricingCases from '../../packages/shared/src/promotions/pricing-cases.json' with { type: 'json' };
import { closeSql, serviceClient, sql, type Client } from './helpers.js';
import { promotionsFixtures } from './promotions-fixtures.js';

const fx = promotionsFixtures('rules');
let service: Client;

beforeAll(() => {
  service = serviceClient();
});

afterAll(async () => {
  await fx.cleanup();
  await closeSql();
});

describe('private.best_promotion — paridad con TypeScript (pricing-cases.json)', () => {
  const caseCategoryId = '00000000-0000-0000-0000-0000000000cc';
  const caseIngredientId = '00000000-0000-0000-0000-0000000000bb';

  beforeAll(async () => {
    // Insertar categoría e insumo fijos para los productos de los casos de prueba
    await sql(
      `insert into public.categories (id, name, is_active)
       values ($1, 'Cat Pricing Cases', true)
       on conflict (id) do nothing`,
      [caseCategoryId],
    );

    await sql(
      `insert into public.ingredients (id, name, unit, is_active)
       values ($1, 'Ing Pricing Cases', 'unidad', true)
       on conflict (id) do nothing`,
      [caseIngredientId],
    );

    // Insertar todos los productIds referenciados en los casos de prueba
    const productIds = new Set<string>();
    for (const c of pricingCases) {
      productIds.add(c.productId);
      for (const p of c.promotions) {
        for (const pid of p.productIds) {
          productIds.add(pid);
        }
      }
    }

    for (const pid of productIds) {
      await sql(
        `insert into public.products (id, category_id, name, price_cents, is_active)
         values ($1, $2, $3, 1000, false)
         on conflict (id) do nothing`,
        [pid, caseCategoryId, `Prod-${pid.slice(0, 8)}`],
      );
      await sql(
        `insert into public.recipe_items (product_id, ingredient_id, quantity)
         values ($1, $2, 1)
         on conflict (product_id, ingredient_id) do nothing`,
        [pid, caseIngredientId],
      );
      await sql(`update public.products set is_active = true where id = $1`, [pid]);
    }
  });

  afterAll(async () => {
    const productIds = new Set<string>();
    for (const c of pricingCases) {
      productIds.add(c.productId);
      for (const p of c.promotions) {
        for (const pid of p.productIds) {
          productIds.add(pid);
        }
      }
    }
    for (const pid of productIds) {
      await sql(`update public.products set is_active = false where id = $1`, [pid]);
      await sql(`delete from public.products where id = $1`, [pid]);
    }
    await sql(`delete from public.ingredients where id = $1`, [caseIngredientId]);
    await sql(`delete from public.categories where id = $1`, [caseCategoryId]);
  });

  for (const c of pricingCases) {
    it(`caso ${c.id}: ${c.description}`, async () => {
      // Limpiar promociones previas del caso si existieran
      const promoIds = c.promotions.map((p) => p.id);
      if (promoIds.length > 0) {
        await sql(`delete from public.promotions where id = any($1)`, [promoIds]);
      }

      // Insertar promociones del caso
      for (const p of c.promotions) {
        await sql(
          `insert into public.promotions (id, name, kind, value, starts_at, ends_at, is_active)
           values ($1, $2, $3::public.promotion_kind, $4, $5, $6, $7)`,
          [p.id, p.name, p.kind, p.value, p.startsAt, p.endsAt, p.isActive],
        );
        for (const pid of p.productIds) {
          await sql(
            `insert into public.promotion_products (promotion_id, product_id)
             values ($1, $2)`,
            [p.id, pid],
          );
        }
      }

      // Ejecutar función SQL
      const rows = await sql<{
        promotion_id: string;
        name: string;
        unit_discount_cents: number;
      }>(
        `select promotion_id, name, unit_discount_cents
         from private.best_promotion($1, $2, $3::timestamptz)`,
        [c.productId, c.priceCents, c.at],
      );

      // Limpiar promociones creadas para este caso
      if (promoIds.length > 0) {
        await sql(`delete from public.promotions where id = any($1)`, [promoIds]);
      }

      if (c.expected === null) {
        expect(rows).toEqual([]);
      } else {
        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual({
          promotion_id: c.expected.promotionId,
          name: c.expected.name,
          unit_discount_cents: c.expected.unitDiscountCents,
        });
      }
    });
  }
});

describe('public.create_promotion', () => {
  it('crea una promoción y sus productos de forma atómica', async () => {
    const catId = await fx.category();
    const prod1 = await fx.product(catId);
    const prod2 = await fx.product(catId);
    const promoName = fx.name('crear-ok');

    const { data: id, error } = await service.rpc('create_promotion', {
      p_name: promoName,
      p_kind: 'porcentaje',
      p_value: 25,
      p_starts_at: '2026-11-20T10:00:00-04:00',
      p_ends_at: '2026-11-25T10:00:00-04:00',
      p_product_ids: [prod1, prod2],
    });

    expect(error).toBeNull();
    expect(id).toBeDefined();

    // Comprobar promoción en BD
    const promos = await sql<{ id: string; name: string; is_active: boolean }>(
      `select id, name, is_active from public.promotions where id = $1`,
      [id],
    );
    expect(promos).toHaveLength(1);
    expect(promos[0]?.name).toBe(promoName);
    expect(promos[0]?.is_active).toBe(true);

    // Comprobar productos asociados
    const prods = await sql<{ product_id: string }>(
      `select product_id from public.promotion_products where promotion_id = $1 order by product_id`,
      [id],
    );
    expect(prods.map((r) => r.product_id).sort()).toEqual([prod1, prod2].sort());
  });

  it('falla con PRODUCT_NOT_FOUND si un producto no existe y no deja registros huérfanos', async () => {
    const catId = await fx.category();
    const prod1 = await fx.product(catId);
    const inexistentProd = crypto.randomUUID();
    const promoName = fx.name('falla-prod');

    const { data, error } = await service.rpc('create_promotion', {
      p_name: promoName,
      p_kind: 'porcentaje',
      p_value: 20,
      p_starts_at: '2026-11-20T10:00:00-04:00',
      p_product_ids: [prod1, inexistentProd],
    });

    expect(data).toBeNull();
    expect(error?.message).toContain('PRODUCT_NOT_FOUND');

    // Verificar que la promoción no se insertó a medias
    const count = await sql<{ n: string }>(
      `select count(*) as n from public.promotions where name = $1`,
      [promoName],
    );
    expect(Number(count[0]?.n)).toBe(0);
  });

  it('falla con PROMOTION_NAME_TAKEN si ya existe una promoción activa con el mismo nombre', async () => {
    const catId = await fx.category();
    const prod1 = await fx.product(catId);
    const promoName = fx.name('repetido');

    await fx.promotion({ name: promoName, productIds: [prod1] });

    const { data, error } = await service.rpc('create_promotion', {
      p_name: `  ${promoName.toUpperCase()}  `,
      p_kind: 'monto_fijo',
      p_value: 500,
      p_starts_at: '2026-11-20T10:00:00-04:00',
      p_product_ids: [prod1],
    });

    expect(data).toBeNull();
    expect(error?.message).toContain('PROMOTION_NAME_TAKEN');
  });
});

describe('public.update_promotion', () => {
  it('actualiza campos y preserva productos cuando p_product_ids es null', async () => {
    const catId = await fx.category();
    const prod1 = await fx.product(catId);
    const promoId = await fx.promotion({
      value: 10,
      productIds: [prod1],
    });

    const newName = fx.name('editado');
    const { error } = await service.rpc('update_promotion', {
      p_id: promoId,
      p_changes: { name: newName, value: 30 },
      p_product_ids: undefined,
    });

    expect(error).toBeNull();

    const [updated] = await sql<{ name: string; value: number }>(
      `select name, value from public.promotions where id = $1`,
      [promoId],
    );
    expect(updated?.name).toBe(newName);
    expect(updated?.value).toBe(30);

    // Los productos se preservan
    const prods = await sql<{ product_id: string }>(
      `select product_id from public.promotion_products where promotion_id = $1`,
      [promoId],
    );
    expect(prods.map((r) => r.product_id)).toEqual([prod1]);
  });

  it('reemplaza la lista completa de productos cuando se envía p_product_ids', async () => {
    const catId = await fx.category();
    const prod1 = await fx.product(catId);
    const prod2 = await fx.product(catId);
    const prod3 = await fx.product(catId);

    const promoId = await fx.promotion({
      productIds: [prod1, prod2],
    });

    const { error } = await service.rpc('update_promotion', {
      p_id: promoId,
      p_changes: {},
      p_product_ids: [prod3],
    });

    expect(error).toBeNull();

    const prods = await sql<{ product_id: string }>(
      `select product_id from public.promotion_products where promotion_id = $1`,
      [promoId],
    );
    expect(prods.map((r) => r.product_id)).toEqual([prod3]);
  });

  it('falla con PROMOTION_NOT_FOUND si la promoción no existe', async () => {
    const { error } = await service.rpc('update_promotion', {
      p_id: crypto.randomUUID(),
      p_changes: { name: 'X' },
    });

    expect(error?.message).toContain('PROMOTION_NOT_FOUND');
  });

  it('falla con PRODUCT_NOT_FOUND si algún producto a reemplazar no existe', async () => {
    const catId = await fx.category();
    const prod1 = await fx.product(catId);
    const promoId = await fx.promotion({ productIds: [prod1] });

    const { error } = await service.rpc('update_promotion', {
      p_id: promoId,
      p_changes: {},
      p_product_ids: [crypto.randomUUID()],
    });

    expect(error?.message).toContain('PRODUCT_NOT_FOUND');

    // La lista previa no cambia
    const prods = await sql<{ product_id: string }>(
      `select product_id from public.promotion_products where promotion_id = $1`,
      [promoId],
    );
    expect(prods.map((r) => r.product_id)).toEqual([prod1]);
  });

  it('falla con PROMOTION_NAME_TAKEN al renombrar con el nombre de otra promoción activa', async () => {
    const catId = await fx.category();
    const prod1 = await fx.product(catId);
    const nameA = fx.name('promo-a');
    const nameB = fx.name('promo-b');

    await fx.promotion({ name: nameA, productIds: [prod1] });
    const idB = await fx.promotion({ name: nameB, productIds: [prod1] });

    const { error } = await service.rpc('update_promotion', {
      p_id: idB,
      p_changes: { name: nameA },
    });

    expect(error?.message).toContain('PROMOTION_NAME_TAKEN');
  });
});
