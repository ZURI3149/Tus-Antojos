import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open(path = '/cocina') {
  const api = createFakeApi();
  const result = renderApp(path, createFakeAuth({ session: 'cocina' }), api);
  return { ...result, user: userEvent.setup() };
}

describe('KitchenPage', () => {
  it('muestra las comandas activas del día organizadas en columnas', async () => {
    open();

    expect(await screen.findByRole('heading', { name: 'Cocina' })).toBeVisible();

    // En seedOrders: Pedido #1 está 'listo' y Pedido #2 está 'pendiente'
    const order1 = await screen.findByTestId('kitchen-order-1');
    const order2 = screen.getByTestId('kitchen-order-2');

    expect(order1).toBeVisible();
    expect(within(order1).getByText('#1')).toBeVisible();
    expect(within(order1).getByText('Listo')).toBeVisible();

    expect(order2).toBeVisible();
    expect(within(order2).getByText('#2')).toBeVisible();
    expect(within(order2).getByText('Pendiente')).toBeVisible();
    expect(within(order2).getByText(/Sin azúcar/)).toBeVisible();
  });

  it('permite a la cocina empezar la preparación de un pedido pendiente', async () => {
    const { user, api } = open();
    const order2 = await screen.findByTestId('kitchen-order-2');
    expect(within(order2).getByText('Pendiente')).toBeVisible();

    const startBtn = within(order2).getByRole('button', { name: /Empezar preparación/i });
    await user.click(startBtn);

    await waitFor(() => {
      expect(api.calls).toHaveBeenCalledWith(
        'POST',
        expect.stringMatching(/\/orders\/.+\/status/),
        { to: 'en_preparacion' },
      );
    });

    // Cambia a estado en preparación
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Listo para entrega/i })).toBeVisible();
    });
    const updatedOrder2 = screen.getByTestId('kitchen-order-2');
    expect(within(updatedOrder2).getByText('En preparación')).toBeVisible();
  });

  it('permite a la cocina marcar como listo un pedido en preparación', async () => {
    const { user, api } = open();
    const order2 = await screen.findByTestId('kitchen-order-2');

    // Primero pasa a en_preparacion
    await user.click(within(order2).getByRole('button', { name: /Empezar preparación/i }));
    const readyBtn = await screen.findByRole('button', { name: /Listo para entrega/i });

    // Luego pasa a listo
    await user.click(readyBtn);

    await waitFor(() => {
      expect(api.calls).toHaveBeenCalledWith(
        'POST',
        expect.stringMatching(/\/orders\/.+\/status/),
        { to: 'listo' },
      );
    });

    const readyOrder = await screen.findByTestId('kitchen-order-2');
    expect(within(readyOrder).getByText(/Esperando entrega en caja/i)).toBeVisible();
  });

  it('muestra el estado vacío cuando no hay pedidos pendientes', async () => {
    const api = createFakeApi();
    // Vaciar lista de órdenes en memoria
    api.orders.data.length = 0;
    renderApp('/cocina', createFakeAuth({ session: 'cocina' }), api);

    expect(
      await screen.findByRole('heading', { name: /No hay pedidos activos en cocina/i }),
    ).toBeVisible();
  });
});
