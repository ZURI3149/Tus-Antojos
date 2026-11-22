import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open(path = '/admin/promociones') {
  const api = createFakeApi();
  const result = renderApp(path, createFakeAuth({ session: 'admin' }), api);
  return { ...result, user: userEvent.setup() };
}

const rowOf = async (name: string) =>
  (await screen.findByText(name, { selector: 'td' })).closest('tr')!;

describe('PromotionsPage', () => {
  it('muestra la lista de promociones con descuento, vigencia, productos y estado', async () => {
    open();
    const verano = await rowOf('Verano 20%');
    expect(within(verano).getByText('20 %')).toBeVisible();
    expect(within(verano).getByText('1 producto')).toBeVisible();
    expect(within(verano).getByText('Vigente')).toBeVisible();

    const fijo = await rowOf('Descuento Fijo Futuro');
    expect(within(fijo).getByText('Bs 2,00')).toBeVisible();
    expect(within(fijo).getByText('Programada')).toBeVisible();

    const cyber = await rowOf('Cyber Pasado');
    expect(within(cyber).getByText('50 %')).toBeVisible();
    expect(within(cyber).getByText('Vencida')).toBeVisible();

    const desactivada = await rowOf('Promo Desactivada');
    expect(within(desactivada).getByText('Bs 5,00')).toBeVisible();
    expect(within(desactivada).getByText('Desactivada')).toBeVisible();
  });

  it('permite filtrar por estado', async () => {
    const { user } = open();
    await rowOf('Verano 20%');

    const select = screen.getByLabelText('Estado');

    // Filtrar solo vigentes
    await user.selectOptions(select, 'vigente');
    expect(await screen.findByText('Verano 20%')).toBeVisible();
    expect(screen.queryByText('Descuento Fijo Futuro')).not.toBeInTheDocument();
    expect(screen.queryByText('Cyber Pasado')).not.toBeInTheDocument();
    expect(screen.queryByText('Promo Desactivada')).not.toBeInTheDocument();

    // Filtrar solo desactivadas
    await user.selectOptions(select, 'desactivada');
    expect(await screen.findByText('Promo Desactivada')).toBeVisible();
    expect(screen.queryByText('Verano 20%')).not.toBeInTheDocument();
    expect(screen.queryByText('Descuento Fijo Futuro')).not.toBeInTheDocument();
  });

  it('permite buscar por nombre', async () => {
    const { user } = open();
    await rowOf('Verano 20%');

    const searchInput = screen.getByLabelText('Buscar promoción');
    await user.type(searchInput, 'fijo');

    expect(await screen.findByText('Descuento Fijo Futuro')).toBeVisible();
    expect(screen.queryByText('Verano 20%')).not.toBeInTheDocument();

    await user.clear(searchInput);
    expect(await screen.findByText('Verano 20%')).toBeVisible();
  });

  it('activar y desactivar actualiza la fila sin recargar la página', async () => {
    const { user, api } = open();
    const verano = await rowOf('Verano 20%');

    // Inicialmente activa
    const toggleButton = within(verano).getByRole('button', { name: 'Desactivar Verano 20%' });
    expect(toggleButton).toBeVisible();

    await user.click(toggleButton);

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('PATCH', expect.stringMatching(/^\/promotions\/.+/), {
        isActive: false,
      }),
    );

    // Tras la mutación, el badge cambia a Desactivada y el botón a Activar
    const updatedVerano = await rowOf('Verano 20%');
    expect(within(updatedVerano).getByText('Desactivada')).toBeVisible();
    expect(within(updatedVerano).getByRole('button', { name: 'Activar Verano 20%' })).toBeVisible();
  });

  it('en /admin la tarjeta de promociones muestra el conteo de vigentes', async () => {
    open('/admin');
    const promoCard = (await screen.findByText('Promociones')).closest('a')!;
    expect(promoCard).toBeVisible();
    expect(await within(promoCard).findByText('1 vigente')).toBeVisible();
  });
});
