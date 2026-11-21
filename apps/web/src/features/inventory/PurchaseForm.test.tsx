import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open() {
  const api = createFakeApi();
  const result = renderApp('/admin/compras/nueva', createFakeAuth({ session: 'admin' }), api);
  return { ...result, user: userEvent.setup() };
}

describe('PurchaseForm', () => {
  it('permite agregar múltiples líneas, calcula totales y registra la compra', async () => {
    const { user, api } = open();

    expect(await screen.findByText('Nueva compra')).toBeVisible();

    // Proveedor y Nota
    await user.type(screen.getByLabelText(/Proveedor/i), 'Distribuidora San Juan');
    await user.type(screen.getByLabelText(/Nota/i), 'Factura 99182');

    // Primera línea: Leche (ml)
    const ingredientSelects = screen.getAllByRole('combobox');
    await user.selectOptions(ingredientSelects[0]!, 'Leche (ml)');

    const qtyInputs = screen.getAllByPlaceholderText('Cantidad');
    await user.clear(qtyInputs[0]!);
    await user.type(qtyInputs[0]!, '3000'); // 3000 ml = 3 L

    const costInputs = screen.getAllByPlaceholderText('0.00');
    await user.clear(costInputs[0]!);
    await user.type(costInputs[0]!, '15.00'); // Bs 15,00

    // Agregar segunda línea
    await user.click(screen.getByRole('button', { name: /Agregar otra línea/i }));

    const updatedSelects = screen.getAllByRole('combobox');
    expect(updatedSelects.length).toBe(2);
    await user.selectOptions(updatedSelects[1]!, 'Azúcar (g)');

    const updatedQty = screen.getAllByPlaceholderText('Cantidad');
    await user.clear(updatedQty[1]!);
    await user.type(updatedQty[1]!, '2000'); // 2000 g = 2 kg

    const updatedCost = screen.getAllByPlaceholderText('0.00');
    await user.clear(updatedCost[1]!);
    await user.type(updatedCost[1]!, '16.00'); // Bs 16,00

    // Total en pantalla = 15.00 + 16.00 = 31.00
    expect(screen.getByText('Bs 31,00')).toBeVisible();

    // Enviar compra
    await user.click(screen.getByRole('button', { name: 'Registrar compra' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith(
        'POST',
        '/inventory/purchases',
        expect.objectContaining({
          supplier: 'Distribuidora San Juan',
          note: 'Factura 99182',
          items: expect.arrayContaining([
            expect.objectContaining({ quantity: 3000, costCents: 1500 }),
            expect.objectContaining({ quantity: 2000, costCents: 1600 }),
          ]),
        }),
      ),
    );
  });

  it('no permite elegir el mismo insumo dos veces en la misma compra', async () => {
    const { user } = open();
    expect(await screen.findByText('Nueva compra')).toBeVisible();

    // Esperar a que carguen los insumos
    await screen.findByRole('option', { name: 'Leche (ml)' });

    // Primera línea: Leche
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0]!, 'Leche (ml)');

    // Agregar segunda línea
    await user.click(screen.getByRole('button', { name: /Agregar otra línea/i }));

    const secondSelect = screen.getAllByRole('combobox')[1]!;
    const lecheOption = within(secondSelect).getByRole('option', { name: 'Leche (ml)' });
    expect(lecheOption).toBeDisabled();
  });
});
