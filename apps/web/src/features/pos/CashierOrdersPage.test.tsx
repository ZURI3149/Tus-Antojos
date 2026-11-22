import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open(path = '/caja/pedidos') {
  const api = createFakeApi();
  const result = renderApp(path, createFakeAuth({ session: 'cajero' }), api);
  return { ...result, user: userEvent.setup() };
}

describe('CashierOrdersPage', () => {
  it('muestra los pedidos del día con su número, estado, método de pago y totales', async () => {
    open();

    expect(await screen.findByRole('heading', { name: 'Pedidos del día' })).toBeVisible();
    expect(await screen.findByRole('tab', { name: /Todos \(2\)/i })).toBeVisible();
    expect(screen.getByRole('tab', { name: /Listos \(1\)/i })).toBeVisible();
    expect(screen.getByRole('tab', { name: /Pendientes \(1\)/i })).toBeVisible();

    // Pedido #1 (en estado listo)
    expect(screen.getByText('Pedido #1')).toBeVisible();
    expect(screen.getByText('Listo')).toBeVisible();
    expect(screen.getByText('Efectivo')).toBeVisible();
    expect(screen.getAllByText('Bs 20,00').length).toBeGreaterThanOrEqual(1);

    // Pedido #2 (en estado pendiente)
    expect(screen.getByText('Pedido #2')).toBeVisible();
    expect(screen.getByText('Pendiente')).toBeVisible();
    expect(screen.getByText('Pago QR')).toBeVisible();
    expect(screen.getAllByText('Bs 10,00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Sin azúcar/)).toBeVisible();
  });

  it('permite filtrar pedidos por estado usando las pestañas', async () => {
    const { user } = open();
    expect(await screen.findByText('Pedido #1')).toBeVisible();

    // Filtrar solo pendientes
    const pendientesTab = screen.getByRole('tab', { name: /Pendientes/i });
    await user.click(pendientesTab);

    expect(screen.getByText('Pedido #2')).toBeVisible();
    expect(screen.queryByText('Pedido #1')).not.toBeInTheDocument();

    // Filtrar solo listos
    const listosTab = screen.getByRole('tab', { name: /Listos/i });
    await user.click(listosTab);

    expect(screen.getByText('Pedido #1')).toBeVisible();
    expect(screen.queryByText('Pedido #2')).not.toBeInTheDocument();
  });

  it('permite buscar pedidos por número o texto de producto', async () => {
    const { user } = open();
    expect(await screen.findByText('Pedido #1')).toBeVisible();

    const searchInput = screen.getByLabelText('Buscar pedidos');
    await user.type(searchInput, '#2');

    expect(screen.getByText('Pedido #2')).toBeVisible();
    expect(screen.queryByText('Pedido #1')).not.toBeInTheDocument();

    await user.clear(searchInput);
    expect(screen.getByText('Pedido #1')).toBeVisible();
    expect(screen.getByText('Pedido #2')).toBeVisible();
  });

  it('permite marcar un pedido listo como entregado', async () => {
    const { user, api } = open();
    expect(await screen.findByText('Pedido #1')).toBeVisible();

    // Botón de entregar
    const deliverBtn = screen.getByRole('button', { name: /Marcar como entregado/i });
    await user.click(deliverBtn);

    await waitFor(() => {
      expect(api.calls).toHaveBeenCalledWith(
        'POST',
        expect.stringMatching(/\/orders\/.+\/status/),
        { to: 'entregado' },
      );
    });

    // El estado cambia a entregado y el botón ya no está
    expect(await screen.findByText('Entregado')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Marcar como entregado/i })).not.toBeInTheDocument();
  });

  it('permite anular un pedido pendiente indicando el motivo', async () => {
    const { user, api } = open();
    expect(await screen.findByText('Pedido #2')).toBeVisible();

    // Botón anular en Pedido #2
    const cancelBtns = screen.getAllByRole('button', { name: /Anular pedido/i });
    await user.click(cancelBtns[0]!);

    // Diálogo abierto
    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(screen.getByRole('heading', { name: /Anular pedido #2/i })).toBeVisible();

    const confirmBtn = screen.getByRole('button', { name: 'Confirmar anulación' });
    expect(confirmBtn).toBeDisabled();

    // Escribir motivo
    const reasonInput = screen.getByLabelText(/Motivo de anulación/i);
    await user.type(reasonInput, 'Cliente no esperó el producto');
    expect(confirmBtn).toBeEnabled();

    await user.click(confirmBtn);

    await waitFor(() => {
      expect(api.calls).toHaveBeenCalledWith(
        'POST',
        expect.stringMatching(/\/orders\/.+\/cancel/),
        { reason: 'Cliente no esperó el producto' },
      );
    });

    // Diálogo cerrado y pedido marcado como anulado con su motivo
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Anulado')).toBeVisible();
    expect(screen.getByText(/Cliente no esperó el producto/)).toBeVisible();
  });
});
