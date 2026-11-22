import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open(path = '/caja') {
  const api = createFakeApi();
  const result = renderApp(path, createFakeAuth({ session: 'cajero' }), api);
  return { ...result, user: userEvent.setup() };
}

describe('PosPage', () => {
  it('muestra los productos activos del catálogo y las categorías', async () => {
    open();

    expect(await screen.findByRole('heading', { name: 'Caja' })).toBeVisible();
    // "Cono simple" está activo en el seed
    expect(await screen.findByText('Cono simple')).toBeVisible();
    // "Malteada" está inactiva en el seed, no debe aparecer en el catálogo para venta
    expect(screen.queryByText('Malteada')).not.toBeInTheDocument();

    // Filtros de categorías
    expect(screen.getByRole('tab', { name: 'Todos' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Helados' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Bebidas' })).toBeVisible();
  });

  it('permite buscar productos por nombre', async () => {
    const { user } = open();
    expect(await screen.findByText('Cono simple')).toBeVisible();

    const searchInput = screen.getByLabelText('Buscar producto');
    await user.type(searchInput, 'inexistente');
    expect(screen.queryByText('Cono simple')).not.toBeInTheDocument();
    expect(screen.getByText('No se encontraron productos')).toBeVisible();

    await user.clear(searchInput);
    expect(await screen.findByText('Cono simple')).toBeVisible();
  });

  it('permite filtrar por categorías', async () => {
    const { user } = open();
    expect(await screen.findByText('Cono simple')).toBeVisible();

    // "Cono simple" pertenece a Helados; Bebidas no tiene productos activos en el seed
    await user.click(screen.getByRole('tab', { name: 'Bebidas' }));
    expect(screen.queryByText('Cono simple')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Helados' }));
    expect(await screen.findByText('Cono simple')).toBeVisible();
  });

  it('agrega un producto al carrito, refleja el precio con promoción activa y totaliza correctamente', async () => {
    const { user } = open();
    expect(await screen.findByText('Cono simple')).toBeVisible();

    // "Cono simple" cuesta Bs 10,00 originalmente, y la promo activa "Verano 20%" descuenta 20% (Bs 2,00) → Bs 8,00
    const productCard = screen.getByRole('button', { name: /Agregar Cono simple al pedido/i });
    await user.click(productCard);

    // El carrito muestra la línea
    const cart = screen.getByLabelText('Carrito de pedido actual');
    expect(within(cart).getByText('Cono simple')).toBeVisible();
    expect(within(cart).getByText(/Verano 20%/)).toBeVisible();
    expect(within(cart).getAllByText('Bs 8,00').length).toBeGreaterThanOrEqual(1);

    // Resumen del carrito
    expect(within(cart).getByText('Subtotal')).toBeVisible();
    expect(within(cart).getAllByText('Bs 10,00').length).toBeGreaterThanOrEqual(1);
    expect(within(cart).getByText('Descuentos aplicados')).toBeVisible();
    expect(within(cart).getByText('-Bs 2,00')).toBeVisible();
    expect(within(cart).getByText('Total a pagar')).toBeVisible();
  });

  it('permite modificar la cantidad, agregar nota y vaciar el carrito', async () => {
    const { user } = open();
    const productCard = await screen.findByRole('button', { name: /Agregar Cono simple al pedido/i });
    await user.click(productCard);

    const cart = screen.getByLabelText('Carrito de pedido actual');
    const plusBtn = within(cart).getByRole('button', { name: /Sumar una unidad de Cono simple/i });
    await user.click(plusBtn);

    // Cantidad = 2, total = 2 * 8 = Bs 16,00
    expect(within(cart).getByLabelText('Cantidad: 2')).toBeVisible();
    expect(within(cart).getAllByText('Bs 16,00').length).toBeGreaterThanOrEqual(1);

    // Agregar nota de preparación
    const noteBtn = within(cart).getByRole('button', { name: /Nota/i });
    await user.click(noteBtn);
    const noteInput = within(cart).getByLabelText(/Nota de cocina para Cono simple/i);
    await user.type(noteInput, 'Para llevar');

    // Vaciar carrito
    const clearBtn = within(cart).getByRole('button', { name: /Vaciar carrito/i });
    await user.click(clearBtn);

    expect(within(cart).getByText('El carrito está vacío')).toBeVisible();
  });

  it('abre el diálogo de cobro y calcula el cambio correctamente para pago en efectivo', async () => {
    const { user, api } = open();
    const productCard = await screen.findByRole('button', { name: /Agregar Cono simple al pedido/i });
    await user.click(productCard);

    const cart = screen.getByLabelText('Carrito de pedido actual');
    const checkoutBtn = within(cart).getByRole('button', { name: /Cobrar Bs 8,00/i });
    await user.click(checkoutBtn);

    // Diálogo abierto
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Cobrar pedido' })).toBeVisible();

    // Seleccionar billete de Bs 20
    const bill20 = screen.getByRole('button', { name: 'Bs 20' });
    await user.click(bill20);

    // Cambio a entregar = 20 - 8 = 12
    expect(screen.getByText('Cambio a entregar:')).toBeVisible();
    expect(screen.getByText('Bs 12,00')).toBeVisible();

    // Confirmar pedido
    const submitBtn = screen.getByRole('button', { name: 'Confirmar y Entregar' });
    await user.click(submitBtn);

    // Verifica que la llamada a la API fue realizada
    await waitFor(() => {
      expect(api.calls).toHaveBeenCalledWith(
        'POST',
        '/orders',
        expect.objectContaining({
          clientOrderId: expect.any(String),
          paymentMethod: 'efectivo',
          items: [
            expect.objectContaining({
              productId: expect.any(String),
              quantity: 1,
            }),
          ],
        }),
        expect.objectContaining({
          'idempotency-key': expect.any(String),
        }),
      );
    });

    // Diálogo cerrado y carrito reseteado
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(within(cart).getByText('El carrito está vacío')).toBeVisible();
  });

  it('permite cobrar mediante pago QR', async () => {
    const { user, api } = open();
    const productCard = await screen.findByRole('button', { name: /Agregar Cono simple al pedido/i });
    await user.click(productCard);

    const cart = screen.getByLabelText('Carrito de pedido actual');
    await user.click(within(cart).getByRole('button', { name: /Cobrar/i }));

    // Cambiar a QR
    const qrRadio = screen.getByRole('radio', { name: /Pago QR/i });
    await user.click(qrRadio);

    expect(screen.getByText('Cobro mediante código QR')).toBeVisible();

    // Confirmar
    const confirmBtn = screen.getByRole('button', { name: 'Confirmar Pago QR' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(api.calls).toHaveBeenCalledWith(
        'POST',
        '/orders',
        expect.objectContaining({
          paymentMethod: 'qr',
        }),
        expect.any(Object),
      );
    });
  });

  it('preserva el clientOrderId para reintento en caso de fallo del servidor', async () => {
    const { user, api } = open();
    const productCard = await screen.findByRole('button', { name: /Agregar Cono simple al pedido/i });
    await user.click(productCard);

    const cart = screen.getByLabelText('Carrito de pedido actual');
    await user.click(within(cart).getByRole('button', { name: /Cobrar/i }));

    // Configurar fallo simulado
    api.failNext(new ApiError(500, 'INTERNAL', 'Error temporal del servidor', undefined, 'req-err'));

    // Botón de monto exacto
    await user.click(screen.getByRole('button', { name: /Exacto/i }));
    await user.click(screen.getByRole('button', { name: 'Confirmar y Entregar' }));

    // Muestra el mensaje de error inline en el diálogo
    expect(await screen.findByRole('alert')).toHaveTextContent('Error temporal del servidor');

    // Reintentar la operación
    await user.click(screen.getByRole('button', { name: 'Confirmar y Entregar' }));

    await waitFor(() => {
      expect(api.calls).toHaveBeenCalledTimes(2);
    });

    // Comprobar que ambas llamadas usaron el mismo clientOrderId
    const call1 = api.calls.mock.calls[0];
    const call2 = api.calls.mock.calls[1];
    const clientOrderId1 = (call1?.[2] as { clientOrderId: string }).clientOrderId;
    const clientOrderId2 = (call2?.[2] as { clientOrderId: string }).clientOrderId;

    expect(clientOrderId1).toBeDefined();
    expect(clientOrderId1).toBe(clientOrderId2);
  });
});
