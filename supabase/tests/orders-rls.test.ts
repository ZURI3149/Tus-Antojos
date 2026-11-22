import { APP_ROLES, type AppRole } from '@tus-antojos/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, closeSql, serviceClient, signedInClient, type Client } from './helpers.js';
import { ordersFixtures } from './orders-fixtures.js';

const PERMISSION_DENIED = '42501';

type Actor = AppRole | 'anon';
const ACTORS: Actor[] = ['anon', ...APP_ROLES];

const fx = ordersFixtures('rls');
const clients = {} as Record<Actor, Client>;
let service: Client;
let orderId: string;

beforeAll(async () => {
  clients.anon = anonClient();
  for (const role of APP_ROLES) clients[role] = await signedInClient(role);
  service = serviceClient();

  const catId = await fx.category();
  const prod = await fx.product(catId);

  const { data } = await service.rpc('create_order', {
    p_client_order_id: crypto.randomUUID(),
    p_items: [{ productId: prod.id, quantity: 1 }],
    p_payment_method: 'efectivo',
  });
  orderId = (data as { id: string }).id;
});

afterAll(async () => {
  await fx.cleanup();
  await closeSql();
});

describe('lectura de pedidos según RLS', () => {
  it.each(APP_ROLES)('%s puede leer pedidos y sus líneas', async (role) => {
    const { data: orders, error: ordersErr } = await clients[role]
      .from('orders')
      .select('id, status, total_cents')
      .eq('id', orderId);

    expect(ordersErr).toBeNull();
    expect(orders).toHaveLength(1);

    const { data: items, error: itemsErr } = await clients[role]
      .from('order_items')
      .select('line_no, product_name, line_total_cents')
      .eq('order_id', orderId);

    expect(itemsErr).toBeNull();
    expect(items).toHaveLength(1);
  });

  it('anon no puede leer pedidos', async () => {
    const { error } = await clients.anon.from('orders').select('id');
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it('solo admin puede leer order_counters', async () => {
    const adminRes = await clients.admin.from('order_counters').select('*');
    expect(adminRes.error).toBeNull();

    const cajeroRes = await clients.cajero.from('order_counters').select('*');
    expect(cajeroRes.data).toHaveLength(0);

    const cocinaRes = await clients.cocina.from('order_counters').select('*');
    expect(cocinaRes.data).toHaveLength(0);
  });
});

describe('bloqueo de escritura directa y ejecución de RPCs', () => {
  it.each(ACTORS)('%s no puede insertar directamente en orders', async (actor) => {
    const { error } = await clients[actor].from('orders').insert({
      client_order_id: crypto.randomUUID(),
      request_hash: 'h',
      business_date: '2026-11-22',
      order_number: 999,
      payment_method: 'efectivo',
      subtotal_cents: 100,
      discount_cents: 0,
      total_cents: 100,
    } as never);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(ACTORS)('%s no puede ejecutar create_order directamente', async (actor) => {
    const { error } = await clients[actor].rpc('create_order', {
      p_client_order_id: crypto.randomUUID(),
      p_items: [],
      p_payment_method: 'efectivo',
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(ACTORS)('%s no puede ejecutar advance_order_status directamente', async (actor) => {
    const { error } = await clients[actor].rpc('advance_order_status', {
      p_order_id: orderId,
      p_to_status: 'en_preparacion',
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(ACTORS)('%s no puede ejecutar cancel_order directamente', async (actor) => {
    const { error } = await clients[actor].rpc('cancel_order', {
      p_order_id: orderId,
      p_reason: 'Hack',
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});
