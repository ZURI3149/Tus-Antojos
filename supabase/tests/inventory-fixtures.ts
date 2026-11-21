import { sql } from './helpers.js';

/**
 * Datos de prueba de inventario, creados y limpiados directamente como `postgres`.
 * Todos los insumos y registros usan un prefijo único para no interferir con otros tests ni con el seed.
 */
export function inventoryFixtures(label: string) {
  const prefix = `zz-inv-${label}-${crypto.randomUUID().slice(0, 8)}-`;
  let counter = 0;
  const name = (base: string) => `${prefix}${base}-${++counter}`;

  async function ingredient(
    opts: { active?: boolean; unit?: 'g' | 'ml' | 'unidad' } = {},
  ): Promise<string> {
    const [row] = await sql<{ id: string }>(
      `insert into public.ingredients (name, unit, is_active) values ($1, $2, $3) returning id`,
      [name('ing'), opts.unit ?? 'g', opts.active ?? true],
    );
    return row!.id;
  }

  async function cleanupInventory(): Promise<void> {
    const like = `${prefix}%`;
    // Solo postgres puede borrar movimientos (append-only trigger lo permite a postgres).
    // Borrado ordenado para respetar las claves foráneas:
    await sql(
      `delete from public.inventory_movements where ingredient_id in (select id from public.ingredients where name like $1)`,
      [like],
    );
    await sql(
      `delete from public.purchase_items where ingredient_id in (select id from public.ingredients where name like $1)`,
      [like],
    );
    await sql(
      `delete from public.inventory_stock where ingredient_id in (select id from public.ingredients where name like $1)`,
      [like],
    );
    await sql(`delete from public.purchases where supplier like $1 or note like $1`, [like]);
    await sql(`delete from public.ingredients where name like $1`, [like]);
  }

  return { prefix, name, ingredient, cleanupInventory };
}
