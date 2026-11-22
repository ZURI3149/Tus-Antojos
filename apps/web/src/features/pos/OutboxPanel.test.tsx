import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Outbox } from '@/lib/offline/outbox';
import type { NewOutboxEntry } from '@/lib/offline/types';
import { provisionalOrderLabel } from '@/lib/offline/use-network-status';
import { reportOutboxDiscard } from '@/lib/sentry';
import type * as SentryModule from '@/lib/sentry';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth, TEST_USERS } from '@/test/fake-auth';
import { createTestOffline, renderApp } from '@/test/render-app';

vi.mock('@/lib/sentry', async (importOriginal) => ({
  ...(await importOriginal<typeof SentryModule>()),
  reportOutboxDiscard: vi.fn(),
}));

/** Simula la red del navegador (jsdom siempre dice estar en línea). */
function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => {
  setOnline(true);
  vi.mocked(reportOutboxDiscard).mockClear();
});

/** Producto activo del seed falso ("Cono simple"). */
async function conoId(api: ReturnType<typeof createFakeApi>): Promise<string> {
  const products = await api.catalog.reader.products();
  return products.find((p) => p.name === 'Cono simple')!.id;
}

function sale(
  productId: string,
  opts: { cashierId?: string; cashierName?: string; totalCents?: number } = {},
): NewOutboxEntry {
  return {
    body: {
      clientOrderId: crypto.randomUUID(),
      items: [{ productId, quantity: 1, note: '' }],
      paymentMethod: 'efectivo',
      createdOfflineAt: new Date(Date.now() - 60_000).toISOString(),
    },
    cashierId: opts.cashierId ?? TEST_USERS.cajero.id,
    cashierName: opts.cashierName ?? TEST_USERS.cajero.fullName,
    charged: {
      lines: [],
      subtotalCents: opts.totalCents ?? 800,
      discountCents: 0,
      totalCents: opts.totalCents ?? 800,
      cashReceivedCents: 1000,
      changeCents: 200,
    },
  };
}

async function openWith(prepare: (outbox: Outbox, productId: string) => Promise<void>) {
  const api = createFakeApi();
  const offline = createTestOffline();
  const outbox = offline.outbox;
  await prepare(outbox, await conoId(api));
  renderApp('/caja/pedidos', createFakeAuth({ session: 'cajero' }), api, offline);
  return { api, outbox, user: userEvent.setup() };
}

describe('panel "Sin sincronizar" en /caja/pedidos (OP4)', () => {
  it('sin pedidos en la cola no se muestra', async () => {
    await openWith(async () => {});

    expect(await screen.findByText('Pedido #1')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Pedidos sin sincronizar' })).toBeNull();
  });

  it('muestra los pendientes con su número provisional, total, intentos y último error', async () => {
    setOnline(false);
    let label = '';
    await openWith(async (outbox, productId) => {
      const entry = await outbox.enqueue(sale(productId));
      label = provisionalOrderLabel(entry.clientOrderId);
      await outbox.scheduleRetry(entry.clientOrderId, {
        error: 'No se pudo conectar con el servidor',
        nextAttemptAt: new Date(Date.now() + 4000),
      });
    });

    const panel = await screen.findByRole('region', { name: 'Pedidos sin sincronizar' });
    expect(within(panel).getByText(label)).toBeVisible();
    expect(within(panel).getByText('Bs 8,00')).toBeVisible();
    expect(within(panel).getByText(/1 intento fallido/)).toBeVisible();
    expect(within(panel).getByText(/No se pudo conectar con el servidor/)).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Sincronizar ahora' })).toBeDisabled();
  });

  it('un pedido por revisar muestra el motivo y se puede reintentar: al volver a enviarse desaparece', async () => {
    let label = '';
    const { outbox, user } = await openWith(async (outbox, productId) => {
      const entry = await outbox.enqueue(sale(productId));
      label = provisionalOrderLabel(entry.clientOrderId);
      await outbox.markForReview(entry.clientOrderId, 'El producto no está activo para la venta');
    });

    const panel = await screen.findByRole('region', { name: 'Pedidos sin sincronizar' });
    expect(within(panel).getByText(/Por revisar/)).toBeVisible();
    expect(within(panel).getByText(/El producto no está activo para la venta/)).toBeVisible();

    await user.click(within(panel).getByRole('button', { name: `Reintentar ${label}` }));

    await waitFor(async () => expect(await outbox.list()).toEqual([]));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Pedidos sin sincronizar' })).toBeNull(),
    );
  });

  it('descartar pide un motivo, confirma, saca el pedido de la cola y lo registra', async () => {
    let label = '';
    let clientOrderId = '';
    const { outbox, user } = await openWith(async (outbox, productId) => {
      const entry = await outbox.enqueue(sale(productId));
      label = provisionalOrderLabel(entry.clientOrderId);
      clientOrderId = entry.clientOrderId;
      await outbox.markForReview(entry.clientOrderId, 'El producto no está activo para la venta');
    });

    const panel = await screen.findByRole('region', { name: 'Pedidos sin sincronizar' });
    await user.click(within(panel).getByRole('button', { name: `Descartar ${label}` }));

    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Descartar pedido' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Motivo/), 'Cobrado a mano en la libreta');
    await user.click(confirm);

    await waitFor(async () => expect(await outbox.list()).toEqual([]));
    expect(reportOutboxDiscard).toHaveBeenCalledWith(
      expect.objectContaining({ clientOrderId, reason: 'Cobrado a mano en la libreta' }),
    );
  });

  it('avisa de los pedidos de otro cajero sin listarlos ni enviarlos', async () => {
    setOnline(false);
    await openWith(async (outbox, productId) => {
      await outbox.enqueue(
        sale(productId, { cashierId: TEST_USERS.admin.id, cashierName: 'Admin de Prueba' }),
      );
      await outbox.enqueue(
        sale(productId, { cashierId: TEST_USERS.admin.id, cashierName: 'Admin de Prueba' }),
      );
    });

    const panel = await screen.findByRole('region', { name: 'Pedidos sin sincronizar' });
    expect(
      within(panel).getByText(/Hay 2 pedidos de Admin de Prueba sin sincronizar/),
    ).toBeVisible();
    expect(within(panel).queryByRole('listitem')).toBeNull();
  });

  it('si al sincronizar el total confirmado difiere de lo cobrado, avisa la diferencia', async () => {
    const { outbox } = await openWith(async (outbox, productId) => {
      // La caja cobró Bs 10,00 pero el servidor calcula Bs 8,00 (promoción vigente).
      await outbox.enqueue(sale(productId, { totalCents: 1000 }));
    });

    await waitFor(async () => expect(await outbox.list()).toEqual([]));
    expect(
      await screen.findByText(/sincronizado con otro total: Bs 8,00 \(la caja cobró Bs 10,00\)/),
    ).toBeVisible();
  });
});
