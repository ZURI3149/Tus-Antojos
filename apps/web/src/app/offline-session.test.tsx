import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveCachedProfile } from '@/features/auth/profile-cache';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth, TEST_USERS } from '@/test/fake-auth';
import { createTestOffline, renderApp } from '@/test/render-app';

/** Simula la red del navegador (jsdom siempre dice estar en línea). */
function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => {
  setOnline(true);
  localStorage.clear();
  vi.restoreAllMocks();
});

const cajero = {
  id: TEST_USERS.cajero.id,
  role: 'cajero' as const,
  fullName: TEST_USERS.cajero.fullName,
  isActive: true,
};

/** Sesión guardada de cajero cuyo perfil no se puede leer (sin red). */
function offlineCajero() {
  const fake = createFakeAuth({ session: 'cajero' });
  fake.mocks.fetchProfile.mockRejectedValue(new TypeError('Failed to fetch'));
  return fake;
}

describe('sesión sin red (OP6)', () => {
  it('con sesión guardada y sin red, /caja abre con el último perfil conocido', async () => {
    saveCachedProfile(cajero);
    setOnline(false);

    renderApp('/caja', offlineCajero(), createFakeApi(), createTestOffline());

    expect(await screen.findByRole('heading', { name: 'Caja' })).toBeVisible();
    expect(screen.getByText('Cajero de Prueba')).toBeVisible();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Modo sin conexión');
  });

  it('si la lectura del perfil falla por red, sigue en la caja (no muestra el error de perfil)', async () => {
    saveCachedProfile(cajero);

    renderApp('/caja', offlineCajero(), createFakeApi(), createTestOffline());

    expect(await screen.findByRole('heading', { name: 'Caja' })).toBeVisible();
    // La consulta reintenta una vez y falla: la página no debe cambiar al error de perfil.
    await new Promise((r) => setTimeout(r, 1500));
    expect(screen.queryByText('No se pudo cargar tu perfil')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Caja' })).toBeVisible();
  });

  it('sin perfil guardado y sin poder leerlo, muestra el error de perfil como antes', async () => {
    renderApp('/caja', offlineCajero(), createFakeApi(), createTestOffline());

    expect(
      await screen.findByText('No se pudo cargar tu perfil', undefined, { timeout: 4000 }),
    ).toBeVisible();
  });

  it('el perfil fresco manda sobre el guardado: un usuario desactivado no entra', async () => {
    saveCachedProfile(cajero);
    const fake = createFakeAuth({
      session: 'cajero',
      profiles: { [cajero.id]: { ...cajero, isActive: false } },
    });

    renderApp('/caja', fake, createFakeApi(), createTestOffline());

    expect(await screen.findByText('Usuario desactivado')).toBeVisible();
  });

  it('un cierre de sesión real lleva a /login y conserva la cola', async () => {
    const fake = createFakeAuth({ session: 'cajero' });
    const offline = createTestOffline();
    setOnline(false);
    await offline.outbox.enqueue({
      body: {
        clientOrderId: crypto.randomUUID(),
        items: [{ productId: 'p1', quantity: 1, note: '' }],
        paymentMethod: 'efectivo',
      },
      cashierId: cajero.id,
      cashierName: cajero.fullName,
      charged: {
        lines: [],
        subtotalCents: 800,
        discountCents: 0,
        totalCents: 800,
        cashReceivedCents: 800,
        changeCents: 0,
      },
    });
    const { router } = renderApp('/caja', fake, createFakeApi(), offline);
    await screen.findByRole('heading', { name: 'Caja' });

    fake.emitSignedOut();

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await offline.outbox.list()).toHaveLength(1);
  });

  describe('cerrar sesión con pedidos sin sincronizar', () => {
    async function withPendingSale() {
      const fake = createFakeAuth({ session: 'cajero' });
      const offline = createTestOffline();
      setOnline(false);
      await offline.outbox.enqueue({
        body: {
          clientOrderId: crypto.randomUUID(),
          items: [{ productId: 'p1', quantity: 1, note: '' }],
          paymentMethod: 'efectivo',
        },
        cashierId: cajero.id,
        cashierName: cajero.fullName,
        charged: {
          lines: [],
          subtotalCents: 800,
          discountCents: 0,
          totalCents: 800,
          cashReceivedCents: 800,
          changeCents: 0,
        },
      });
      const result = renderApp('/caja', fake, createFakeApi(), offline);
      await screen.findByRole('heading', { name: 'Caja' });
      await waitFor(() =>
        expect(screen.getByRole('status', { name: '' })).toHaveTextContent('1 pedido sin enviar'),
      );
      return { ...result, fake, user: userEvent.setup() };
    }

    it('pide confirmación y, si se cancela, sigue con la sesión', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const { fake, router, user } = await withPendingSale();

      await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

      expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 pedido sin sincronizar'));
      expect(fake.mocks.signOut).not.toHaveBeenCalled();
      expect(router.state.location.pathname).toBe('/caja');
    });

    it('si se confirma, cierra la sesión', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { fake, router, user } = await withPendingSale();

      await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

      await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
      expect(fake.mocks.signOut).toHaveBeenCalled();
    });
  });
});
