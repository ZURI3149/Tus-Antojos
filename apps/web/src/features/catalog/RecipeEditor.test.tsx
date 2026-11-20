import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api-client';
import { createFakeApi, type FakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

const CONO = '00000000-0000-4000-8000-0000000000f1';
const MALTEADA = '00000000-0000-4000-8000-0000000000f2';
const LECHE = '00000000-0000-4000-8000-0000000000e1';
const AZUCAR = '00000000-0000-4000-8000-0000000000e2';
const HELADOS = '00000000-0000-4000-8000-0000000000c1';
const TEMPORADA = '00000000-0000-4000-8000-0000000000c3';

function open(path: string, api: FakeApi = createFakeApi()) {
  const result = renderApp(path, createFakeAuth({ session: 'admin' }), api);
  return { ...result, user: userEvent.setup() };
}

const form = () => screen.findByRole('form', { name: 'Datos del producto' });
const options = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((o) => ({ name: o.textContent, disabled: (o as HTMLOptionElement).disabled }));
const writeCalls = (api: FakeApi) =>
  api.calls.mock.calls.filter(([method]) => method !== 'GET').map(([m, p]) => `${m} ${p}`);

describe('RecipeEditor y activación', () => {
  it('crea un producto activo con 2 insumos en un solo guardado, convirtiendo kg a g (CA-07)', async () => {
    const { user, api } = open('/admin/productos/nuevo');
    const f = await form();
    await user.type(within(f).getByLabelText('Nombre'), 'Helado de leche');
    await user.selectOptions(within(f).getByLabelText('Categoría'), 'Helados');
    await user.type(within(f).getByLabelText('Precio (Bs)'), '15');

    await user.click(within(f).getByRole('button', { name: 'Agregar insumo' }));
    await user.selectOptions(within(f).getByLabelText('Insumo 1'), 'Leche');
    await user.type(within(f).getByLabelText('Cantidad 1'), '250');
    await user.click(within(f).getByRole('button', { name: 'Agregar insumo' }));
    await user.selectOptions(within(f).getByLabelText('Insumo 2'), 'Azúcar');
    await user.selectOptions(within(f).getByLabelText('Unidad 2'), 'kg');
    await user.type(within(f).getByLabelText('Cantidad 2'), '1,5');
    await user.click(within(f).getByRole('switch', { name: 'Activo' }));
    await user.click(within(f).getByRole('button', { name: 'Crear producto' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('POST', '/products', {
        name: 'Helado de leche',
        description: '',
        categoryId: HELADOS,
        priceCents: 1500,
        isActive: true,
        recipe: [
          { ingredientId: LECHE, quantity: 250 },
          { ingredientId: AZUCAR, quantity: 1500 },
        ],
      }),
    );
    const created = api.catalog.data.products.find((p) => p.name === 'Helado de leche')!;
    expect(created.isActive).toBe(true);
  });

  it('ofrece las unidades de cada insumo y solo insumos activos, sin repetirlos', async () => {
    const { user } = open('/admin/productos/nuevo');
    const f = await form();
    await user.click(within(f).getByRole('button', { name: 'Agregar insumo' }));
    await user.selectOptions(within(f).getByLabelText('Insumo 1'), 'Azúcar');
    expect(options(within(f).getByLabelText('Unidad 1')).map((o) => o.name)).toEqual(['g', 'kg']);
    await user.selectOptions(within(f).getByLabelText('Insumo 1'), 'Leche');
    expect(options(within(f).getByLabelText('Unidad 1')).map((o) => o.name)).toEqual(['ml', 'L']);

    await user.click(within(f).getByRole('button', { name: 'Agregar insumo' }));
    expect(options(within(f).getByLabelText('Insumo 2'))).toEqual([
      { name: 'Elige un insumo', disabled: false },
      { name: 'Azúcar', disabled: false },
      { name: 'Leche', disabled: true },
    ]);
  });

  it('rechaza cantidades que no dan un entero en la unidad base', async () => {
    const { user } = open('/admin/productos/nuevo');
    const f = await form();
    await user.click(within(f).getByRole('button', { name: 'Agregar insumo' }));
    await user.selectOptions(within(f).getByLabelText('Insumo 1'), 'Azúcar');
    await user.selectOptions(within(f).getByLabelText('Unidad 1'), 'kg');
    await user.type(within(f).getByLabelText('Cantidad 1'), '1,2345');
    await user.click(within(f).getByRole('button', { name: 'Crear producto' }));
    expect(await within(f).findByText('Cantidad inválida: máximo 3 decimales')).toBeVisible();
  });

  it('sin receta el interruptor está bloqueado y explica por qué (CA-02)', async () => {
    const { user } = open('/admin/productos/nuevo');
    const f = await form();
    const active = within(f).getByRole('switch', { name: 'Activo' });
    expect(active).toBeDisabled();
    expect(within(f).getByText('Agrega al menos un insumo a la receta')).toBeVisible();

    await user.click(within(f).getByRole('button', { name: 'Agregar insumo' }));
    await user.selectOptions(within(f).getByLabelText('Insumo 1'), 'Leche');
    expect(active).toBeEnabled();
  });

  it('con la categoría inactiva no se puede activar', async () => {
    const api = createFakeApi();
    const malteada = api.catalog.data.products.find((p) => p.id === MALTEADA)!;
    malteada.categoryId = TEMPORADA;
    malteada.recipe = [{ ingredientId: LECHE, quantity: 300 }];
    open(`/admin/productos/${MALTEADA}`, api);
    const f = await form();
    expect(within(f).getByRole('switch', { name: 'Activo' })).toBeDisabled();
    expect(within(f).getByText('La categoría Temporada está inactiva')).toBeVisible();
  });

  it('edita la receta: 0,5 L se guarda como 500 ml y solo se llama al PUT', async () => {
    const { user, api } = open(`/admin/productos/${CONO}`);
    const f = await form();
    expect(within(f).getByLabelText('Insumo 1')).toHaveValue(LECHE);
    expect(within(f).getByLabelText('Cantidad 1')).toHaveValue('100');
    expect(within(f).getByLabelText('Unidad 1')).toHaveValue('ml');

    await user.selectOptions(within(f).getByLabelText('Unidad 1'), 'L');
    await user.clear(within(f).getByLabelText('Cantidad 1'));
    await user.type(within(f).getByLabelText('Cantidad 1'), '0,5');
    await user.click(within(f).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('PUT', `/products/${CONO}/recipe`, {
        items: [{ ingredientId: LECHE, quantity: 500 }],
      }),
    );
    expect(writeCalls(api)).toEqual([`PUT /products/${CONO}/recipe`]);
  });

  it('activar con receta nueva guarda primero la receta y después el estado', async () => {
    const { user, api } = open(`/admin/productos/${MALTEADA}`);
    const f = await form();
    await user.click(within(f).getByRole('button', { name: 'Agregar insumo' }));
    await user.selectOptions(within(f).getByLabelText('Insumo 1'), 'Leche');
    await user.type(within(f).getByLabelText('Cantidad 1'), '300');
    await user.click(within(f).getByRole('switch', { name: 'Activo' }));
    await user.click(within(f).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(writeCalls(api)).toEqual([
        `PUT /products/${MALTEADA}/recipe`,
        `PATCH /products/${MALTEADA}`,
      ]),
    );
    expect(api.catalog.data.products.find((p) => p.id === MALTEADA)!.isActive).toBe(true);
  });

  it('desactivar y vaciar la receta guarda primero el estado', async () => {
    const { user, api } = open(`/admin/productos/${CONO}`);
    const f = await form();
    await user.click(within(f).getByRole('switch', { name: 'Activo' }));
    await user.click(within(f).getByRole('button', { name: 'Quitar insumo 1' }));
    await user.click(within(f).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(writeCalls(api)).toEqual([`PATCH /products/${CONO}`, `PUT /products/${CONO}/recipe`]),
    );
    const cono = api.catalog.data.products.find((p) => p.id === CONO)!;
    expect(cono).toMatchObject({ isActive: false, recipe: [] });
  });

  it('si la API rechaza la activación, muestra el motivo y el producto sigue inactivo (CA-02)', async () => {
    const api = createFakeApi();
    const { user } = open(`/admin/productos/${MALTEADA}`, api);
    const f = await form();
    await user.click(within(f).getByRole('button', { name: 'Agregar insumo' }));
    await user.selectOptions(within(f).getByLabelText('Insumo 1'), 'Leche');
    await user.type(within(f).getByLabelText('Cantidad 1'), '300');
    await user.click(within(f).getByRole('switch', { name: 'Activo' }));
    // Otro admin desactivó la leche entre medio.
    api.failNext(
      new ApiError(
        422,
        'BUSINESS_RULE',
        'La receta usa un insumo inactivo',
        { reason: 'INGREDIENT_INACTIVE' },
        'r',
      ),
    );
    await user.click(within(f).getByRole('button', { name: 'Guardar cambios' }));

    expect(await within(f).findByText('La receta usa un insumo inactivo')).toBeVisible();
    expect(api.catalog.data.products.find((p) => p.id === MALTEADA)!.isActive).toBe(false);
  });
});
