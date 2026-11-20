import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open(path = '/admin/categorias') {
  const api = createFakeApi();
  const result = renderApp(path, createFakeAuth({ session: 'admin' }), api);
  return { ...result, user: userEvent.setup() };
}

const rowOf = async (name: string) =>
  (await screen.findByText(name, { selector: 'td' })).closest('tr')!;

describe('CategoriesPage', () => {
  it('lista las categorías por orden con su estado', async () => {
    open();
    const helados = await rowOf('Helados');
    expect(within(helados).getByText('Activo')).toBeVisible();
    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.children[1]?.textContent);
    expect(names).toEqual(['Helados', 'Bebidas', 'Temporada']);
  });

  it('crea una categoría y aparece en la lista', async () => {
    const { user, api } = open();
    await rowOf('Helados');
    await user.click(screen.getByRole('button', { name: 'Nueva categoría' }));
    const form = screen.getByRole('form', { name: 'Nueva categoría' });
    await user.type(within(form).getByLabelText('Nombre'), '  Postres ');
    await user.clear(within(form).getByLabelText('Orden'));
    await user.type(within(form).getByLabelText('Orden'), '3');
    await user.click(within(form).getByRole('button', { name: 'Crear categoría' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('POST', '/categories', {
        name: 'Postres',
        sortOrder: 3,
        isActive: true,
      }),
    );
    expect(await rowOf('Postres')).toBeVisible();
    expect(await screen.findByText('Categoría creada')).toBeVisible();
    expect(screen.queryByRole('form', { name: 'Nueva categoría' })).not.toBeInTheDocument();
  });

  it('valida en el cliente sin llamar a la API', async () => {
    const { user, api } = open();
    await rowOf('Helados');
    await user.click(screen.getByRole('button', { name: 'Nueva categoría' }));
    const form = screen.getByRole('form', { name: 'Nueva categoría' });
    await user.click(within(form).getByRole('button', { name: 'Crear categoría' }));
    expect(await within(form).findByText('Ingresa el nombre')).toBeVisible();
    expect(api.calls).not.toHaveBeenCalledWith('POST', expect.anything(), expect.anything());
  });

  it('un nombre repetido se marca en el campo', async () => {
    const { user } = open();
    await rowOf('Helados');
    await user.click(screen.getByRole('button', { name: 'Nueva categoría' }));
    const form = screen.getByRole('form', { name: 'Nueva categoría' });
    await user.type(within(form).getByLabelText('Nombre'), 'helados');
    await user.click(within(form).getByRole('button', { name: 'Crear categoría' }));
    expect(await within(form).findByText('Ya existe una categoría con ese nombre')).toBeVisible();
  });

  it('edita nombre y orden', async () => {
    const { user, api } = open();
    await user.click(await screen.findByRole('button', { name: 'Editar Bebidas' }));
    const form = screen.getByRole('form', { name: 'Editar Bebidas' });
    const name = within(form).getByLabelText('Nombre');
    await user.clear(name);
    await user.type(name, 'Bebidas frías');
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('PATCH', expect.stringMatching(/^\/categories\//), {
        name: 'Bebidas frías',
        sortOrder: 2,
      }),
    );
    expect(await rowOf('Bebidas frías')).toBeVisible();
  });

  it('desactiva y vuelve a activar una categoría sin productos activos', async () => {
    const { user } = open();
    await user.click(await screen.findByRole('button', { name: 'Desactivar Bebidas' }));
    expect(within(await rowOf('Bebidas')).getByText('Inactivo')).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Activar Bebidas' }));
    expect(within(await rowOf('Bebidas')).getByText('Activo')).toBeVisible();
  });

  it('no deja desactivar una categoría con productos activos y explica por qué', async () => {
    const { user } = open();
    await user.click(await screen.findByRole('button', { name: 'Desactivar Helados' }));
    expect(
      await screen.findByText('La categoría tiene productos activos (1 producto)'),
    ).toBeVisible();
    expect(within(await rowOf('Helados')).getByText('Activo')).toBeVisible();
  });

  it('se llega desde Administración', async () => {
    const { user, router } = open('/admin');
    await user.click(await screen.findByRole('link', { name: /Categorías/ }));
    expect(router.state.location.pathname).toBe('/admin/categorias');
    expect(await screen.findByRole('heading', { level: 1, name: 'Categorías' })).toBeVisible();
  });
});
