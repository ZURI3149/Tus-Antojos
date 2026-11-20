import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open() {
  const result = renderApp(
    '/admin/productos',
    createFakeAuth({ session: 'admin' }),
    createFakeApi(),
  );
  return { ...result, user: userEvent.setup() };
}

const rowOf = async (name: string) =>
  (await screen.findByText(name, { selector: 'td' })).closest('tr')!;
const visibleNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.children[0]?.textContent);

describe('ProductsPage', () => {
  it('lista los productos con categoría, precio en Bs y estado', async () => {
    open();
    const cono = await rowOf('Cono simple');
    expect(within(cono).getByText('Helados')).toBeVisible();
    expect(within(cono).getByText('Bs 10,00')).toBeVisible();
    expect(within(cono).getByText('Activo')).toBeVisible();
    const malteada = await rowOf('Malteada');
    expect(within(malteada).getByText('Bebidas')).toBeVisible();
    expect(within(malteada).getByText('Bs 18,50')).toBeVisible();
    expect(within(malteada).getByText('Inactivo')).toBeVisible();
  });

  it('busca sin distinguir mayúsculas ni tildes', async () => {
    const { user } = open();
    await rowOf('Cono simple');
    await user.type(screen.getByLabelText('Buscar producto'), 'MALTEADA');
    expect(visibleNames()).toEqual(['Malteada']);
    await user.clear(screen.getByLabelText('Buscar producto'));
    await user.type(screen.getByLabelText('Buscar producto'), 'xyz');
    expect(screen.getByText('Ningún producto coincide con los filtros.')).toBeVisible();
  });

  it('filtra por categoría y por estado', async () => {
    const { user } = open();
    await rowOf('Cono simple');
    await user.selectOptions(screen.getByLabelText('Categoría'), 'Helados');
    expect(visibleNames()).toEqual(['Cono simple']);
    await user.selectOptions(screen.getByLabelText('Categoría'), 'Todas las categorías');
    await user.selectOptions(screen.getByLabelText('Estado'), 'Inactivos');
    expect(visibleNames()).toEqual(['Malteada']);
  });

  it('lleva al formulario de alta y al de edición', async () => {
    const { user, router } = open();
    await user.click(await screen.findByRole('link', { name: 'Editar Malteada' }));
    expect(router.state.location.pathname).toBe(
      '/admin/productos/00000000-0000-4000-8000-0000000000f2',
    );
    expect(await screen.findByRole('heading', { name: 'Malteada' })).toBeVisible();
  });

  it('cajero no entra a la lista de productos', async () => {
    const { router } = renderApp('/admin/productos', createFakeAuth({ session: 'cajero' }));
    await screen.findByText('Sin acceso');
    expect(router.state.location.pathname).toBe('/sin-acceso');
  });
});
