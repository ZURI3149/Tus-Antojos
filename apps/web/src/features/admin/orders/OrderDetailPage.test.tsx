import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open(orderId: string) {
  const api = createFakeApi();
  const result = renderApp(`/admin/pedidos/${orderId}`, createFakeAuth({ session: 'admin' }), api);
  return { ...result, user: userEvent.setup(), api };
}

describe('Admin OrderDetailPage', () => {
  it('muestra el encabezado, productos, totales, eventos y movimientos de inventario', async () => {
    open('00000000-0000-4000-8000-0000000000o1');

    // Encabezado
    expect(await screen.findByRole('heading', { name: 'Pedido #1' })).toBeVisible();
    expect(screen.getAllByText('Listo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Efectivo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Cajero de Prueba/).length).toBeGreaterThanOrEqual(1);

    // Tabla de productos
    expect(screen.getByText('Cono simple')).toBeVisible();
    expect(screen.getByRole('cell', { name: '2' })).toBeVisible();
    expect(screen.getAllByText('Bs 20,00').length).toBeGreaterThanOrEqual(1);

    // Totales
    expect(screen.getByText('Subtotal')).toBeVisible();
    expect(screen.getByText('Total neto')).toBeVisible();

    // Historial de eventos
    expect(screen.getByText('Historial de cambios de estado')).toBeVisible();
    expect(screen.getByText(/eventos registrados/i)).toBeVisible();

    // Movimientos de kardex
    expect(screen.getByText('Movimientos en inventario (Kardex)')).toBeVisible();
    const ingredientLink = screen.getByRole('link', { name: 'Harina especial' });
    expect(ingredientLink).toBeVisible();
    expect(ingredientLink).toHaveAttribute(
      'href',
      '/admin/inventario/00000000-0000-4000-8000-0000000000i1',
    );
    expect(screen.getByText('-200 g')).toBeVisible();
  });

  it('permite a un administrador anular un pedido pendiente indicando motivo', async () => {
    const { user } = open('00000000-0000-4000-8000-0000000000o2');

    expect(await screen.findByRole('heading', { name: 'Pedido #2' })).toBeVisible();
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThanOrEqual(1);

    // Botón de anular presente
    const cancelButton = screen.getByRole('button', { name: /Anular pedido/i });
    expect(cancelButton).toBeVisible();

    await user.click(cancelButton);

    // Diálogo de confirmación
    expect(await screen.findByRole('heading', { name: /Anular pedido #2/i })).toBeVisible();
    expect(
      screen.getByText(/Esta acción devolverá los ingredientes descontados al inventario/i),
    ).toBeVisible();

    // Escribir motivo
    const reasonInput = screen.getByLabelText(/Motivo de anulación/i);
    await user.type(reasonInput, 'Error en cobro por QR');

    const confirmButton = screen.getByRole('button', { name: /^Confirmar anulación$/i });
    await user.click(confirmButton);

    // El pedido pasa al estado anulado
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeVisible();
    });
    expect(screen.getByText(/Pedido anulado/i)).toBeVisible();
    expect(screen.getAllByText(/Error en cobro por QR/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Anulado').length).toBeGreaterThanOrEqual(1);

    // No se puede volver a anular
    expect(screen.queryByRole('button', { name: /Anular pedido/i })).not.toBeInTheDocument();
  });
});
