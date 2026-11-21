import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open(path = '/admin/inventario') {
  const api = createFakeApi();
  const result = renderApp(path, createFakeAuth({ session: 'admin' }), api);
  return { ...result, user: userEvent.setup() };
}

const rowOf = async (name: string) =>
  (await screen.findByText(name, { selector: 'a' })).closest('tr')!;

describe('StockPage', () => {
  it('muestra la lista de insumos con stock, costo promedio, valor total y estado', async () => {
    open();
    const leche = await rowOf('Leche');
    expect(within(leche).getByText('2 L')).toBeVisible();
    expect(within(leche).getByText('1 L')).toBeVisible();
    expect(within(leche).getByText('Bs 5,00 / L')).toBeVisible();
    expect(within(leche).getByText('Bs 10,00')).toBeVisible();
    expect(within(leche).getByText('Normal')).toBeVisible();

    const azucar = await rowOf('Azúcar');
    expect(within(azucar).getByText('500 g')).toBeVisible();
    expect(within(azucar).getByText('1 kg')).toBeVisible();
    expect(within(azucar).getByText('Bs 8,00 / kg')).toBeVisible();
    expect(within(azucar).getByText('Bs 4,00')).toBeVisible();
    expect(within(azucar).getByText('Bajo mínimo')).toBeVisible();
  });

  it('permite filtrar por término de búsqueda y por solo alertas', async () => {
    const { user } = open();
    await rowOf('Leche');

    // Búsqueda
    await user.type(screen.getByLabelText('Buscar insumo'), 'azucar');
    expect(await screen.findByText('Azúcar', { selector: 'a' })).toBeVisible();
    expect(screen.queryByText('Leche', { selector: 'a' })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Buscar insumo'));
    expect(await screen.findByText('Leche', { selector: 'a' })).toBeVisible();

    // Filtro de solo alertas
    await user.click(screen.getByRole('checkbox', { name: /Mostrar solo alertas/i }));
    expect(await screen.findByText('Azúcar', { selector: 'a' })).toBeVisible();
    expect(screen.queryByText('Leche', { selector: 'a' })).not.toBeInTheDocument();
  });

  it('permite registrar una merma con motivo mediante el diálogo modal', async () => {
    const { user, api } = open();
    const leche = await rowOf('Leche');
    await user.click(within(leche).getByRole('button', { name: /Merma/i }));

    const dialog = screen.getByRole('dialog', { name: /Registrar merma/i });
    expect(dialog).toBeVisible();

    const qtyInput = within(dialog).getByLabelText(/Cantidad a descartar/i);
    await user.clear(qtyInput);
    await user.type(qtyInput, '200');

    const reasonInput = within(dialog).getByLabelText(/Motivo de la merma/i);
    await user.type(reasonInput, 'Envase roto por manipulación');

    await user.click(within(dialog).getByRole('button', { name: 'Registrar merma' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith(
        'POST',
        '/inventory/waste',
        expect.objectContaining({
          quantity: 200,
          reason: 'Envase roto por manipulación',
        }),
      ),
    );
  });

  it('permite realizar un conteo físico mediante el diálogo modal', async () => {
    const { user, api } = open();
    const leche = await rowOf('Leche');
    await user.click(within(leche).getByRole('button', { name: /Conteo/i }));

    const dialog = screen.getByRole('dialog', { name: /Conteo físico/i });
    expect(dialog).toBeVisible();

    const countedInput = within(dialog).getByLabelText(/Cantidad física contada/i);
    await user.clear(countedInput);
    await user.type(countedInput, '2500');

    const reasonInput = within(dialog).getByLabelText(/Motivo del ajuste/i);
    await user.type(reasonInput, 'Ajuste de inventario semanal');

    await user.click(within(dialog).getByRole('button', { name: 'Registrar ajuste' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith(
        'POST',
        '/inventory/counts',
        expect.objectContaining({
          counted: 2500,
          reason: 'Ajuste de inventario semanal',
        }),
      ),
    );
  });

  it('permite modificar el stock mínimo de un insumo', async () => {
    const { user, api } = open();
    const leche = await rowOf('Leche');
    await user.click(within(leche).getByRole('button', { name: /Mínimo/i }));

    const dialog = screen.getByRole('dialog', { name: /Stock mínimo/i });
    expect(dialog).toBeVisible();

    const minInput = within(dialog).getByLabelText(/Cantidad mínima/i);
    await user.clear(minInput);
    await user.type(minInput, '1500');

    await user.click(within(dialog).getByRole('button', { name: 'Guardar mínimo' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith(
        'PATCH',
        expect.stringMatching(/\/inventory\/stock\//),
        { minQuantity: 1500 },
      ),
    );
  });
});
