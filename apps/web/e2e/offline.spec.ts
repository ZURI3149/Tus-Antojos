import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';
import { loginAs, SEED_PASSWORD, SEED_USERS } from './support';

/**
 * OP-01 / CE-06: sin red la caja registra 20 ventas en efectivo; tras recargar siguen en la cola;
 * al volver la red se sincronizan todas en < 10 s, sin duplicados. Corre contra el build de
 * producción (proyecto `offline` de playwright.config.ts) porque necesita el service worker.
 */
const SALES = 20;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} (lo define playwright.config.ts)`);
  return value;
}

function serviceClient() {
  return createClient(env('E2E_SUPABASE_URL'), env('E2E_SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Claves de la cola leídas directamente de IndexedDB en la página. */
function outboxIds(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('tus-antojos');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction('outbox', 'readonly').objectStore('outbox').getAllKeys();
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            db.close();
            resolve(req.result as string[]);
          };
        };
      }),
  );
}

/** Espera a que el service worker controle la página (precache listo para trabajar sin red). */
async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);
  }
}

async function sellOneCono(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Agregar Cono simple al pedido/i }).click();
  const cart = page.getByLabel('Carrito de pedido actual');
  await cart.getByRole('button', { name: /Cobrar/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Exacto/i }).click();
  await dialog.getByRole('button', { name: 'Confirmar y Entregar' }).click();
  await expect(dialog).toBeHidden();
  await expect(cart.getByText('El carrito está vacío')).toBeVisible();
}

/** Deja el stock como estaba: el admin anula por la API los pedidos que creó la prueba. */
async function cancelOrders(clientOrderIds: string[]): Promise<void> {
  if (clientOrderIds.length === 0) return;
  const { data: orders } = await serviceClient()
    .from('orders')
    .select('id, status')
    .in('client_order_id', clientOrderIds);
  const browser = createClient(env('E2E_SUPABASE_URL'), env('E2E_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await browser.auth.signInWithPassword({
    email: SEED_USERS.admin.email,
    password: SEED_PASSWORD,
  });
  const token = data.session?.access_token;
  for (const order of orders ?? []) {
    if (order.status !== 'pendiente' && order.status !== 'en_preparacion') continue;
    await fetch(`${env('E2E_API_URL')}/orders/${order.id}/cancel`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'Limpieza de la prueba E2E offline' }),
    });
  }
}

test.describe('caja sin conexión', () => {
  let created: string[] = [];

  test.afterEach(async () => {
    await cancelOrders(created);
    created = [];
  });

  test(`OP-01: ${SALES} ventas sin red sobreviven a una recarga y se sincronizan sin duplicados`, async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);

    // 1. Con red: iniciar sesión, cargar la caja (guarda catálogo y perfil) y el service worker.
    await loginAs(page, 'cajero');
    await expect(
      page.getByRole('button', { name: /Agregar Cono simple al pedido/i }),
    ).toBeVisible();
    await waitForServiceWorker(page);
    await expect(
      page.getByRole('button', { name: /Agregar Cono simple al pedido/i }),
    ).toBeVisible();

    // 2. Sin red: el indicador lo dice y el QR no está disponible.
    await context.setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: 'Modo sin conexión' })).toBeVisible();
    await page.getByRole('button', { name: /Agregar Cono simple al pedido/i }).click();
    await page
      .getByLabel('Carrito de pedido actual')
      .getByRole('button', { name: /Cobrar/i })
      .click();
    await expect(page.getByRole('radio', { name: /Pago QR/i })).toBeDisabled();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    await page
      .getByLabel('Carrito de pedido actual')
      .getByRole('button', { name: /Vaciar carrito/i })
      .click();

    // 3. 20 ventas en efectivo sin red.
    for (let i = 0; i < SALES; i++) await sellOneCono(page);
    await expect(
      page.getByRole('status').filter({ hasText: `${SALES} pedidos sin enviar` }),
    ).toBeVisible();
    created = await outboxIds(page);
    expect(created).toHaveLength(SALES);

    // 4. Recargar sin red: la caja abre desde el service worker, con la copia del catálogo,
    //    y la cola sigue ahí.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Caja' })).toBeVisible();
    await expect(page.getByText(/Catálogo del \d{2}\/\d{2} \d{2}:\d{2}/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Agregar Cono simple al pedido/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: `${SALES} pedidos sin enviar` }),
    ).toBeVisible();
    expect(await outboxIds(page)).toEqual(expect.arrayContaining(created));

    // 5. Volver la red: todo se sincroniza en < 10 s.
    const reconnectedAt = Date.now();
    await context.setOffline(false);
    await expect.poll(() => outboxIds(page), { timeout: 10_000 }).toEqual([]);
    expect(Date.now() - reconnectedAt).toBeLessThan(10_000);
    await expect(page.getByRole('status').filter({ hasText: 'En línea' })).toBeVisible();

    // 6. En la BD: exactamente los 20 pedidos, una vez cada uno, marcados como offline.
    const { data: orders, error } = await serviceClient()
      .from('orders')
      .select('client_order_id, order_number, created_offline_at, payment_method')
      .in('client_order_id', created);
    expect(error).toBeNull();
    expect(orders).toHaveLength(SALES);
    expect(new Set(orders!.map((o) => o.client_order_id)).size).toBe(SALES);
    expect(new Set(orders!.map((o) => o.order_number)).size).toBe(SALES);
    for (const order of orders!) {
      expect(order.created_offline_at).not.toBeNull();
      expect(order.payment_method).toBe('efectivo');
    }
  });
});
