import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open(path = '/admin/pedidos') {
  const api = createFakeApi();
  const result = renderApp(path, createFakeAuth({ session: 'admin' }), api);
  return { ...result, user: userEvent.setup(), api };
}

describe('Admin OrdersPage', () => {
  it('muestra la lista de pedidos con número, hora, total, método de pago, estado y cajero', async () => {
    open();

    expect(await screen.findByRole('heading', { name: 'Historial de pedidos' })).toBeVisible();

    // Esperar a que la tabla cargue
    expect(await screen.findByRole('columnheader', { name: 'Número' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Hora' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Método' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Cajero' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Offline' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Acciones' })).toBeVisible();

    // Pedido #1 y Pedido #2
    expect(screen.getByText('#1')).toBeVisible();
    expect(screen.getByText('#2')).toBeVisible();
    expect(screen.getByText('Bs 20,00')).toBeVisible();
    expect(screen.getByText('Bs 10,00')).toBeVisible();
    expect(screen.getAllByText('Listo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Efectivo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('QR').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Cajero de Prueba').length).toBeGreaterThanOrEqual(1);

    // Enlaces de detalle
    const detailLinks = screen.getAllByRole('link', { name: /Ver detalle/i });
    expect(detailLinks.length).toBe(2);
  });

  it('permite filtrar pedidos por estado', async () => {
    const { user } = open();

    expect(await screen.findByText('#1')).toBeVisible();
    expect(screen.getByText('#2')).toBeVisible();

    const statusSelect = screen.getByLabelText('Estado');
    await user.selectOptions(statusSelect, 'pendiente');

    expect(screen.getByText('#2')).toBeVisible();
    expect(screen.queryByText('#1')).not.toBeInTheDocument();

    await user.selectOptions(statusSelect, 'listo');
    expect(screen.getByText('#1')).toBeVisible();
    expect(screen.queryByText('#2')).not.toBeInTheDocument();
  });

  it('permite filtrar pedidos por método de pago', async () => {
    const { user } = open();

    expect(await screen.findByText('#1')).toBeVisible();
    expect(screen.getByText('#2')).toBeVisible();

    const paymentSelect = screen.getByLabelText('Método de pago');
    await user.selectOptions(paymentSelect, 'qr');

    expect(screen.getByText('#2')).toBeVisible();
    expect(screen.queryByText('#1')).not.toBeInTheDocument();

    await user.selectOptions(paymentSelect, 'efectivo');
    expect(screen.getByText('#1')).toBeVisible();
    expect(screen.queryByText('#2')).not.toBeInTheDocument();
  });

  it('muestra mensaje cuando no hay resultados para los filtros', async () => {
    const { user } = open();

    expect(await screen.findByText('#1')).toBeVisible();

    const statusSelect = screen.getByLabelText('Estado');
    await user.selectOptions(statusSelect, 'anulado');

    expect(
      screen.getByText('No se encontraron pedidos con los filtros seleccionados.'),
    ).toBeVisible();
  });
});
