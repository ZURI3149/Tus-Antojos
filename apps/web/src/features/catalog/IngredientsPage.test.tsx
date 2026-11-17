import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open() {
  const api = createFakeApi();
  const result = renderApp('/admin/insumos', createFakeAuth({ session: 'admin' }), api);
  return { ...result, user: userEvent.setup() };
}

const rowOf = async (name: string) =>
  (await screen.findByText(name, { selector: 'td' })).closest('tr')!;

describe('IngredientsPage', () => {
  it('lista los insumos con su medida y en cuántas recetas están', async () => {
    open();
    const leche = await rowOf('Leche');
    expect(within(leche).getByText('Volumen (ml, L)')).toBeVisible();
    expect(within(leche).getByText('1')).toBeVisible();
    const azucar = await rowOf('Azúcar');
    expect(within(azucar).getByText('Peso (g, kg)')).toBeVisible();
    expect(within(azucar).getByText('0')).toBeVisible();
  });

  it('busca sin distinguir mayúsculas ni tildes', async () => {
    const { user } = open();
    await rowOf('Leche');
    await user.type(screen.getByLabelText('Buscar insumo'), 'AZUCAR');
    expect(screen.getByText('Azúcar', { selector: 'td' })).toBeVisible();
    expect(screen.queryByText('Leche', { selector: 'td' })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Buscar insumo'));
    await user.type(screen.getByLabelText('Buscar insumo'), 'xyz');
    expect(screen.getByText('Ningún insumo coincide con la búsqueda.')).toBeVisible();
  });

  it('crea un insumo en su unidad base', async () => {
    const { user, api } = open();
    await rowOf('Leche');
    await user.click(screen.getByRole('button', { name: 'Nuevo insumo' }));
    const form = screen.getByRole('form', { name: 'Nuevo insumo' });
    await user.type(within(form).getByLabelText('Nombre'), 'Conos de galleta');
    await user.selectOptions(within(form).getByLabelText('Medida'), 'Unidades');
    await user.click(within(form).getByRole('button', { name: 'Crear insumo' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('POST', '/ingredients', {
        name: 'Conos de galleta',
        unit: 'unidad',
        isActive: true,
      }),
    );
    expect(within(await rowOf('Conos de galleta')).getByText('Unidades')).toBeVisible();
  });

  it('un nombre repetido se marca en el campo', async () => {
    const { user } = open();
    await rowOf('Leche');
    await user.click(screen.getByRole('button', { name: 'Nuevo insumo' }));
    const form = screen.getByRole('form', { name: 'Nuevo insumo' });
    await user.type(within(form).getByLabelText('Nombre'), 'LECHE');
    await user.click(within(form).getByRole('button', { name: 'Crear insumo' }));
    expect(await within(form).findByText('Ya existe un insumo con ese nombre')).toBeVisible();
  });

  it('cambia la unidad de un insumo que no está en recetas', async () => {
    const { user, api } = open();
    await user.click(await screen.findByRole('button', { name: 'Editar Azúcar' }));
    const form = screen.getByRole('form', { name: 'Editar Azúcar' });
    await user.selectOptions(within(form).getByLabelText('Medida'), 'Unidades');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('PATCH', expect.stringMatching(/^\/ingredients\//), {
        name: 'Azúcar',
        unit: 'unidad',
      }),
    );
  });

  it('bloquea la unidad de un insumo que está en una receta, pero deja renombrarlo', async () => {
    const { user, api } = open();
    await user.click(await screen.findByRole('button', { name: 'Editar Leche' }));
    const form = screen.getByRole('form', { name: 'Editar Leche' });
    expect(within(form).getByLabelText('Medida')).toBeDisabled();
    expect(within(form).getByText('No se puede cambiar: está en 1 receta')).toBeVisible();

    const name = within(form).getByLabelText('Nombre');
    await user.clear(name);
    await user.type(name, 'Leche entera');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('PATCH', expect.stringMatching(/^\/ingredients\//), {
        name: 'Leche entera',
      }),
    );
    expect(await rowOf('Leche entera')).toBeVisible();
  });

  it('no deja desactivar un insumo que usa un producto activo y dice cuál (CA-03)', async () => {
    const { user } = open();
    await user.click(await screen.findByRole('button', { name: 'Desactivar Leche' }));
    expect(
      await screen.findByText('El insumo se usa en productos activos: Cono simple'),
    ).toBeVisible();
    expect(within(await rowOf('Leche')).getByText('Activo')).toBeVisible();
  });

  it('desactiva un insumo sin uso', async () => {
    const { user } = open();
    await user.click(await screen.findByRole('button', { name: 'Desactivar Azúcar' }));
    expect(within(await rowOf('Azúcar')).getByText('Inactivo')).toBeVisible();
  });
});
