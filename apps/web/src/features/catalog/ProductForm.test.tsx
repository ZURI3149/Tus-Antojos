import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

const MALTEADA = '00000000-0000-4000-8000-0000000000f2';
const HELADOS = '00000000-0000-4000-8000-0000000000c1';
const BEBIDAS = '00000000-0000-4000-8000-0000000000c2';

function open(path: string) {
  const api = createFakeApi();
  const result = renderApp(path, createFakeAuth({ session: 'admin' }), api);
  return { ...result, user: userEvent.setup() };
}

const form = () => screen.findByRole('form', { name: 'Datos del producto' });

describe('ProductForm: alta', () => {
  it('crea el producto inactivo con el precio en centavos y lleva a su edición', async () => {
    const { user, api, router } = open('/admin/productos/nuevo');
    const f = await form();
    await user.type(within(f).getByLabelText('Nombre'), 'Banana split');
    await user.type(within(f).getByLabelText('Descripción'), 'Con tres bolas');
    await user.selectOptions(within(f).getByLabelText('Categoría'), 'Helados');
    await user.type(within(f).getByLabelText('Precio (Bs)'), '12,50');
    await user.click(within(f).getByRole('button', { name: 'Crear producto' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('POST', '/products', {
        name: 'Banana split',
        description: 'Con tres bolas',
        categoryId: HELADOS,
        priceCents: 1250,
      }),
    );
    const created = api.catalog.data.products.find((p) => p.name === 'Banana split')!;
    expect(created.isActive).toBe(false);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/admin/productos/${created.id}`),
    );
  });

  it('solo ofrece categorías activas', async () => {
    open('/admin/productos/nuevo');
    const select = within(await form()).getByLabelText('Categoría');
    const options = within(select)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual(['Elige una categoría', 'Helados', 'Bebidas']);
  });

  it('valida los campos antes de enviar', async () => {
    const { user, api } = open('/admin/productos/nuevo');
    const f = await form();
    await user.type(within(f).getByLabelText('Precio (Bs)'), '12,505');
    await user.click(within(f).getByRole('button', { name: 'Crear producto' }));
    await within(f).findByText('Ingresa el nombre');
    expect(
      within(f)
        .getAllByRole('alert')
        .map((a) => a.textContent),
    ).toEqual([
      'Ingresa el nombre',
      'Elige una categoría',
      'Ingresa un monto válido, p. ej. 12,50',
    ]);
    expect(api.calls).not.toHaveBeenCalledWith('POST', '/products', expect.anything());
  });

  it('un precio de 0 se rechaza', async () => {
    const { user } = open('/admin/productos/nuevo');
    const f = await form();
    await user.type(within(f).getByLabelText('Precio (Bs)'), '0');
    await user.click(within(f).getByRole('button', { name: 'Crear producto' }));
    expect(await within(f).findByText('El precio debe ser mayor a 0')).toBeVisible();
  });

  it('un nombre repetido se marca en el campo', async () => {
    const { user } = open('/admin/productos/nuevo');
    const f = await form();
    await user.type(within(f).getByLabelText('Nombre'), 'cono SIMPLE');
    await user.selectOptions(within(f).getByLabelText('Categoría'), 'Helados');
    await user.type(within(f).getByLabelText('Precio (Bs)'), '10');
    await user.click(within(f).getByRole('button', { name: 'Crear producto' }));
    expect(await within(f).findByText('Ya existe un producto con ese nombre')).toBeVisible();
  });
});

describe('ProductForm: edición', () => {
  it('carga los datos con el precio en Bs y envía solo lo que cambió', async () => {
    const { user, api } = open(`/admin/productos/${MALTEADA}`);
    const f = await form();
    expect(within(f).getByLabelText('Nombre')).toHaveValue('Malteada');
    expect(within(f).getByLabelText('Descripción')).toHaveValue('De vainilla');
    expect(within(f).getByLabelText('Categoría')).toHaveValue(BEBIDAS);
    const price = within(f).getByLabelText('Precio (Bs)');
    expect(price).toHaveValue('18,50');

    await user.clear(price);
    await user.type(price, '20');
    await user.click(within(f).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('PATCH', `/products/${MALTEADA}`, {
        priceCents: 2000,
      }),
    );
    expect(api.catalog.data.products.find((p) => p.id === MALTEADA)!.priceCents).toBe(2000);
  });

  it('una categoría que quedó inactiva se muestra pero no se puede volver a elegir', async () => {
    const api = createFakeApi();
    api.catalog.data.products.find((p) => p.id === MALTEADA)!.categoryId =
      '00000000-0000-4000-8000-0000000000c3';
    renderApp(`/admin/productos/${MALTEADA}`, createFakeAuth({ session: 'admin' }), api);
    const select = within(await form()).getByLabelText('Categoría');
    expect(within(select).getByRole('option', { name: 'Temporada (inactiva)' })).toBeDisabled();
    expect(within(select).getByRole('option', { name: 'Helados' })).toBeEnabled();
  });

  it('un producto que no existe muestra un aviso', async () => {
    open('/admin/productos/00000000-0000-4000-8000-00000000ffff');
    expect(await screen.findByText('El producto no existe o fue eliminado.')).toBeVisible();
  });
});
