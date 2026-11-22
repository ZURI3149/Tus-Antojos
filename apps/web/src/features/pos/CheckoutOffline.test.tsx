import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { NetworkBadgeView } from '@/components/network-badge';
import { ApiError } from '@/lib/api-client';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth, TEST_USERS } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';
import { render } from '@testing-library/react';

/** Simula la red del navegador (jsdom siempre dice estar en línea). */
function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => {
  setOnline(true);
});

function open() {
  const api = createFakeApi();
  const result = renderApp('/caja', createFakeAuth({ session: 'cajero' }), api);
  return { ...result, user: userEvent.setup() };
}

async function addConoAndOpenCheckout(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Agregar Cono simple al pedido/i }));
  const cart = screen.getByLabelText('Carrito de pedido actual');
  await user.click(within(cart).getByRole('button', { name: /Cobrar/i }));
  return cart;
}

describe('caja sin conexión (OP3)', () => {
  it('sin red, el pago QR está deshabilitado con su explicación', async () => {
    const { user } = open();
    await addConoAndOpenCheckout(user);

    setOnline(false);

    const qr = await screen.findByRole('radio', { name: /Pago QR/i });
    expect(qr).toBeDisabled();
    expect(qr).toHaveAccessibleDescription(/El pago QR necesita conexión/);
  });

  it('sin red, una venta en efectivo se encola con la hora de la venta y no llama a la API', async () => {
    const { user, api, outbox } = open();
    const cart = await addConoAndOpenCheckout(user);
    setOnline(false);

    await user.click(screen.getByRole('button', { name: 'Bs 20' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar y Entregar' }));

    // El aviso muestra el número provisional y que falta sincronizar.
    expect(await screen.findByText(/Pedido OFF-[0-9A-F]{4} guardado sin conexión/)).toBeVisible();
    expect(screen.getByText(/Pendiente de sincronizar/)).toBeVisible();
    expect(within(cart).getByText('El carrito está vacío')).toBeVisible();

    const [entry] = await outbox.list();
    expect(entry).toMatchObject({
      status: 'pendiente',
      cashierId: TEST_USERS.cajero.id,
      body: {
        paymentMethod: 'efectivo',
        items: [expect.objectContaining({ quantity: 1 })],
        createdOfflineAt: expect.any(String),
      },
      charged: { totalCents: 800, cashReceivedCents: 2000, changeCents: 1200 },
    });
    expect(api.calls).not.toHaveBeenCalledWith(
      'POST',
      '/orders',
      expect.anything(),
      expect.anything(),
    );
  });

  it('en línea, si el servidor no responde, la venta en efectivo se encola con el mismo cuerpo', async () => {
    const { user, api, outbox } = open();
    await addConoAndOpenCheckout(user);
    api.failNext(
      new ApiError(0, 'NETWORK', 'No se pudo conectar con el servidor', undefined, null),
    );

    await user.click(screen.getByRole('button', { name: /Exacto/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmar y Entregar' }));

    await waitFor(async () => expect(await outbox.list()).toHaveLength(1));
    const sentBody = api.calls.mock.calls.find((c) => c[1] === '/orders')?.[2];
    const [entry] = await outbox.list();
    // Mismo cuerpo, sin createdOfflineAt: si la BD sí lo registró, el reenvío da 200 (no 409).
    expect(entry?.body).toEqual(sentBody);
    expect(entry?.body.createdOfflineAt).toBeUndefined();
  });

  it('en línea, un error de negocio (422) no se encola: se muestra como siempre', async () => {
    const { user, api, outbox } = open();
    await addConoAndOpenCheckout(user);
    api.failNext(
      new ApiError(
        422,
        'BUSINESS_RULE',
        'El producto no está activo para la venta',
        {
          reason: 'PRODUCT_INACTIVE',
        },
        'r1',
      ),
    );

    await user.click(screen.getByRole('button', { name: /Exacto/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmar y Entregar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El producto no está activo para la venta',
    );
    expect(await outbox.list()).toEqual([]);
  });

  it('al volver la conexión, el pedido encolado se envía y sale de la cola', async () => {
    const { user, api, outbox } = open();
    await addConoAndOpenCheckout(user);
    setOnline(false);
    await user.click(screen.getByRole('button', { name: /Exacto/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmar y Entregar' }));
    await waitFor(async () => expect(await outbox.list()).toHaveLength(1));
    const [queued] = await outbox.list();

    setOnline(true);

    await waitFor(async () => expect(await outbox.list()).toEqual([]));
    expect(api.calls).toHaveBeenCalledWith(
      'POST',
      '/orders',
      expect.objectContaining({ clientOrderId: queued?.clientOrderId }),
      expect.anything(),
    );
  });

  it('el indicador del encabezado muestra la red y los pedidos sin enviar', async () => {
    const { user } = open();
    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('En línea');

    await addConoAndOpenCheckout(user);
    setOnline(false);
    await user.click(screen.getByRole('button', { name: /Exacto/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmar y Entregar' }));

    await waitFor(() =>
      expect(document.querySelector('[data-state="offline"]')).toHaveTextContent(
        'Modo sin conexión · 1 pedido sin enviar',
      ),
    );
  });
});

describe('NetworkBadgeView', () => {
  it.each([
    [true, 0, 'En línea'],
    [true, 3, 'Sincronizando 3 pedidos'],
    [false, 0, 'Modo sin conexión'],
    [false, 1, 'Modo sin conexión · 1 pedido sin enviar'],
  ])('online=%s, pendientes=%s → "%s"', (online, pending, text) => {
    render(<NetworkBadgeView online={online} pending={pending} />);
    expect(screen.getByRole('status')).toHaveTextContent(text);
  });
});
