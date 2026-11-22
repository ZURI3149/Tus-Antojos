import { APP_ROLES, type AppRole } from '@tus-antojos/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, closeSql, serviceClient, signedInClient, type Client } from './helpers.js';
import { promotionsFixtures } from './promotions-fixtures.js';

// PR-05: ningún cliente escribe en promociones ni ejecuta sus RPC.
// cajero y cocina leen solo lo activo; admin lee todo.

const PERMISSION_DENIED = '42501';

type Actor = AppRole | 'anon';
const ACTORS: Actor[] = ['anon', ...APP_ROLES];

const fx = promotionsFixtures('rls');
const clients = {} as Record<Actor, Client>;
const ids = {} as {
  category: string;
  product: string;
  activePromo: string;
  inactivePromo: string;
};

beforeAll(async () => {
  clients.anon = anonClient();
  for (const role of APP_ROLES) clients[role] = await signedInClient(role);

  ids.category = await fx.category();
  ids.product = await fx.product(ids.category);
  ids.activePromo = await fx.promotion({
    name: fx.name('activa'),
    isActive: true,
    productIds: [ids.product],
  });
  ids.inactivePromo = await fx.promotion({
    name: fx.name('inactiva'),
    isActive: false,
    productIds: [ids.product],
  });
});

afterAll(async () => {
  await fx.cleanup();
  await closeSql();
});

describe('escrituras desde el cliente en promotions', () => {
  it.each(ACTORS)('%s no puede insertar en promotions', async (actor) => {
    const { error } = await clients[actor].from('promotions').insert({
      name: fx.name('hack'),
      kind: 'porcentaje',
      value: 10,
      starts_at: '2026-11-20T00:00:00-04:00',
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(ACTORS)('%s no puede actualizar en promotions', async (actor) => {
    const { error } = await clients[actor]
      .from('promotions')
      .update({ value: 50 })
      .eq('id', ids.activePromo);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(ACTORS)('%s no puede borrar en promotions', async (actor) => {
    const { error } = await clients[actor].from('promotions').delete().eq('id', ids.activePromo);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(ACTORS)('%s no puede insertar en promotion_products', async (actor) => {
    const { error } = await clients[actor].from('promotion_products').insert({
      promotion_id: ids.activePromo,
      product_id: ids.product,
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe('ejecución de RPCs desde clientes', () => {
  it.each(ACTORS)('%s no puede llamar a create_promotion', async (actor) => {
    const { error } = await clients[actor].rpc('create_promotion', {
      p_name: 'Hack',
      p_kind: 'porcentaje',
      p_value: 10,
      p_starts_at: '2026-11-20T00:00:00-04:00',
      p_product_ids: [ids.product],
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(ACTORS)('%s no puede llamar a update_promotion', async (actor) => {
    const { error } = await clients[actor].rpc('update_promotion', {
      p_id: ids.activePromo,
      p_changes: { value: 10 },
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it('service_role sí puede ejecutar los RPCs', async () => {
    const service = serviceClient();
    const { data: newId, error } = await service.rpc('create_promotion', {
      p_name: fx.name('service-rpc'),
      p_kind: 'porcentaje',
      p_value: 10,
      p_starts_at: '2026-11-20T00:00:00-04:00',
      p_product_ids: [ids.product],
    });
    expect(error).toBeNull();
    expect(newId).toBeDefined();
  });
});

describe('visibilidad RLS en promotions', () => {
  it('anon no puede leer promotions ni promotion_products', async () => {
    const res1 = await clients.anon.from('promotions').select('*');
    expect(res1.error?.code).toBe(PERMISSION_DENIED);

    const res2 = await clients.anon.from('promotion_products').select('*');
    expect(res2.error?.code).toBe(PERMISSION_DENIED);
  });

  it('cajero y cocina solo ven promociones activas', async () => {
    for (const role of ['cajero', 'cocina'] as const) {
      const { data, error } = await clients[role]
        .from('promotions')
        .select('id, is_active')
        .in('id', [ids.activePromo, ids.inactivePromo]);

      expect(error).toBeNull();
      const idsFound = (data ?? []).map((r) => r.id);
      expect(idsFound).toContain(ids.activePromo);
      expect(idsFound).not.toContain(ids.inactivePromo);
    }
  });

  it('admin ve promociones activas e inactivas', async () => {
    const { data, error } = await clients.admin
      .from('promotions')
      .select('id, is_active')
      .in('id', [ids.activePromo, ids.inactivePromo]);

    expect(error).toBeNull();
    const idsFound = (data ?? []).map((r) => r.id);
    expect(idsFound).toContain(ids.activePromo);
    expect(idsFound).toContain(ids.inactivePromo);
  });

  it('cajero y cocina no ven promotion_products de promociones inactivas', async () => {
    for (const role of ['cajero', 'cocina'] as const) {
      const { data, error } = await clients[role]
        .from('promotion_products')
        .select('promotion_id')
        .in('promotion_id', [ids.activePromo, ids.inactivePromo]);

      expect(error).toBeNull();
      const promoIds = (data ?? []).map((r) => r.promotion_id);
      expect(promoIds).toContain(ids.activePromo);
      expect(promoIds).not.toContain(ids.inactivePromo);
    }
  });
});
