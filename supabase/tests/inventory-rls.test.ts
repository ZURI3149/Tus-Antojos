import { APP_ROLES, type AppRole } from '@tus-antojos/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  anonClient,
  closeSql,
  serviceClient,
  signedInClient,
  sql,
  type Client,
} from './helpers.js';
import { inventoryFixtures } from './inventory-fixtures.js';

const PERMISSION_DENIED = '42501';
const INVENTORY_TABLES = [
  'inventory_stock',
  'purchases',
  'purchase_items',
  'inventory_movements',
] as const;

type Actor = AppRole | 'anon';
const ACTORS: Actor[] = ['anon', ...APP_ROLES];

const fx = inventoryFixtures('rls');
const clients = {} as Record<Actor, Client>;
let service: Client;
let testIngredientId: string;
let testPurchaseId: string;

beforeAll(async () => {
  service = serviceClient();
  clients.anon = anonClient();
  for (const role of APP_ROLES) {
    clients[role] = await signedInClient(role);
  }

  testIngredientId = await fx.ingredient();

  // Crear una compra y movimiento con serviceClient para tener datos en las 4 tablas
  const { data: purchaseId } = await service.rpc('register_purchase', {
    p_purchased_on: '2026-11-20',
    p_supplier: fx.name('sup-rls'),
    p_note: fx.name('note-rls'),
    p_items: [{ ingredientId: testIngredientId, quantity: 500, costCents: 400 }],
  });
  testPurchaseId = purchaseId!;
});

afterAll(async () => {
  await fx.cleanupInventory();
  await closeSql();
});

describe('IN-04: Inmutabilidad del kardex (KARDEX_APPEND_ONLY)', () => {
  it('ni service_role puede modificar ni borrar un movimiento (sin privilegio UPDATE/DELETE)', async () => {
    const updateRes = await service
      .from('inventory_movements')
      .update({ reason: 'Modificación no permitida' } as never)
      .eq('ingredient_id', testIngredientId);
    expect(updateRes.error?.code).toBe(PERMISSION_DENIED);

    const deleteRes = await service
      .from('inventory_movements')
      .delete()
      .eq('ingredient_id', testIngredientId);
    expect(deleteRes.error?.code).toBe(PERMISSION_DENIED);
  });

  it('el trigger KARDEX_APPEND_ONLY sigue activo como segunda barrera', async () => {
    const rows = await sql<{ tgenabled: string }>(
      `select tgenabled from pg_trigger
       where tgrelid = 'public.inventory_movements'::regclass
         and tgname = 'inventory_movements_append_only'`,
    );
    expect(rows).toEqual([{ tgenabled: 'O' }]);
  });

  it.each(ACTORS)('%s no puede actualizar ni borrar movimientos del kardex', async (actor) => {
    const updateRes = await clients[actor]
      .from('inventory_movements')
      .update({ reason: 'Hacking kardex' } as never)
      .eq('ingredient_id', testIngredientId);
    expect(updateRes.error?.code).toBe(PERMISSION_DENIED);

    const deleteRes = await clients[actor]
      .from('inventory_movements')
      .delete()
      .eq('ingredient_id', testIngredientId);
    expect(deleteRes.error?.code).toBe(PERMISSION_DENIED);
  });

  it('solo postgres puede borrar para mantenimiento y limpieza de tests', async () => {
    // Verificamos que sql() (conexión postgres) puede ejecutar deletes
    const testIng = await fx.ingredient();
    await service.rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: fx.name('sup-tmp'),
      p_note: fx.name('note-tmp'),
      p_items: [{ ingredientId: testIng, quantity: 100, costCents: 50 }],
    });

    await expect(
      sql(`delete from public.inventory_movements where ingredient_id = $1`, [testIng]),
    ).resolves.toBeDefined();
  });
});

describe('IN-05: Políticas de lectura RLS y restricción de escrituras', () => {
  it.each(['cajero', 'cocina'] as const)(
    '%s no ve ninguna fila de las tablas de inventario',
    async (actor) => {
      for (const table of INVENTORY_TABLES) {
        const { data, error } = await clients[actor].from(table).select('*');
        expect(error).toBeNull();
        expect(data).toHaveLength(0);
      }
    },
  );

  it.each(INVENTORY_TABLES)('anon no puede leer %s', async (table) => {
    const { error } = await clients.anon.from(table).select('*').limit(1);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it('admin ve las filas de inventario', async () => {
    const stockRes = await clients.admin
      .from('inventory_stock')
      .select('*')
      .eq('ingredient_id', testIngredientId);
    expect(stockRes.error).toBeNull();
    expect(stockRes.data!.length).toBeGreaterThanOrEqual(1);

    const purchasesRes = await clients.admin.from('purchases').select('*').eq('id', testPurchaseId);
    expect(purchasesRes.error).toBeNull();
    expect(purchasesRes.data!.length).toBe(1);

    const itemsRes = await clients.admin
      .from('purchase_items')
      .select('*')
      .eq('purchase_id', testPurchaseId);
    expect(itemsRes.error).toBeNull();
    expect(itemsRes.data!.length).toBe(1);

    const movsRes = await clients.admin
      .from('inventory_movements')
      .select('*')
      .eq('ingredient_id', testIngredientId);
    expect(movsRes.error).toBeNull();
    expect(movsRes.data!.length).toBeGreaterThanOrEqual(1);
  });

  it.each(ACTORS)(
    '%s no puede insertar ni escribir directamente en las 4 tablas',
    async (actor) => {
      const dummyId = '00000000-0000-4000-a000-000000000099';

      // inventory_stock
      const insStock = await clients[actor].from('inventory_stock').insert({
        ingredient_id: dummyId,
        quantity: 10,
      } as never);
      expect(insStock.error?.code).toBe(PERMISSION_DENIED);

      // purchases
      const insPurch = await clients[actor].from('purchases').insert({
        purchased_on: '2026-11-20',
        total_cents: 100,
      } as never);
      expect(insPurch.error?.code).toBe(PERMISSION_DENIED);

      // purchase_items
      const insItem = await clients[actor].from('purchase_items').insert({
        purchase_id: dummyId,
        ingredient_id: dummyId,
        quantity: 1,
        cost_cents: 1,
      } as never);
      expect(insItem.error?.code).toBe(PERMISSION_DENIED);

      // inventory_movements
      const insMov = await clients[actor].from('inventory_movements').insert({
        ingredient_id: dummyId,
        type: 'compra',
        quantity: 1,
        cost_cents: 1,
        balance_quantity: 1,
        balance_avg_unit_cost: '1.0',
      } as never);
      expect(insMov.error?.code).toBe(PERMISSION_DENIED);
    },
  );

  it.each(ACTORS)('%s no puede ejecutar los RPCs de inventario desde el cliente', async (actor) => {
    const purchase = await clients[actor].rpc('register_purchase', {
      p_purchased_on: '2026-11-20',
      p_supplier: 'test',
      p_note: '',
      p_items: [{ ingredientId: testIngredientId, quantity: 100, costCents: 100 }],
    });
    expect(purchase.error?.code).toBe(PERMISSION_DENIED);

    const waste = await clients[actor].rpc('record_waste', {
      p_ingredient_id: testIngredientId,
      p_quantity: 10,
      p_reason: 'test',
    });
    expect(waste.error?.code).toBe(PERMISSION_DENIED);

    const count = await clients[actor].rpc('count_stock', {
      p_ingredient_id: testIngredientId,
      p_counted: 100,
      p_reason: 'test',
    });
    expect(count.error?.code).toBe(PERMISSION_DENIED);
  });
});
