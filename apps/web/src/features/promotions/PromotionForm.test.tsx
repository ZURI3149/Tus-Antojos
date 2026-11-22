import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { createFakeCatalog } from '@/test/fake-catalog';
import { renderApp } from '@/test/render-app';

function open(path = '/admin/promociones/nueva') {
  const catalog = createFakeCatalog();
  const cono = catalog.data.products[0]!;
  catalog.data.products.push({
    ...cono,
    id: '00000000-0000-4000-8000-0000000000f3',
    name: 'Torta artesanal',
    priceCents: 2500,
    isActive: true,
  });
  const api = createFakeApi(undefined, catalog);
  const result = renderApp(path, createFakeAuth({ session: 'admin' }), api);
  return { ...result, user: userEvent.setup() };
}

describe('PromotionForm', () => {
  it('permite crear una promoción del 20 % con vista previa Bs 25,00 → Bs 20,00 y fecha con offset -04:00', async () => {
    const { user, api } = open('/admin/promociones/nueva');

    // Esperar carga del formulario
    await screen.findByRole('form', { name: 'Datos de la promoción' });

    // Completar nombre
    await user.type(screen.getByLabelText('Nombre'), 'Super Verano 20%');

    // Descuento 20%
    await user.type(screen.getByLabelText('Porcentaje (%)'), '20');

    // Fechas
    await user.clear(screen.getByLabelText('Inicio (hora de Bolivia)'));
    await user.type(screen.getByLabelText('Inicio (hora de Bolivia)'), '2029-06-01T10:00');

    await user.type(screen.getByLabelText('Fin (opcional)'), '2029-06-30T22:00');

    // Agregar toda la categoría Helados
    const addCatBtn = screen.getByRole('button', { name: 'Agregar toda la categoría Helados' });
    await user.click(addCatBtn);

    // Verificar que la vista previa muestra los precios calculados (Cono simple 10,00 -> 8,00 y Torta 25,00 -> 20,00)
    const preview = await screen.findByRole('region', { name: 'Vista previa de precios' });
    expect(within(preview).getByText('Torta artesanal')).toBeVisible();
    expect(within(preview).getByText('Bs 20,00')).toBeVisible(); // 25,00 - 20% = 20,00

    // Enviar formulario
    await user.click(screen.getByRole('button', { name: 'Crear promoción' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('POST', '/promotions', {
        name: 'Super Verano 20%',
        kind: 'porcentaje',
        value: 20,
        startsAt: '2029-06-01T10:00:00-04:00',
        endsAt: '2029-06-30T22:00:00-04:00',
        productIds: expect.arrayContaining([
          '00000000-0000-4000-8000-0000000000f1',
          '00000000-0000-4000-8000-0000000000f3',
        ]),
        isActive: true,
      }),
    );
  });

  it('permite descuento de monto fijo (Bs 2,50 se envía como 250 centavos)', async () => {
    const { user, api } = open('/admin/promociones/nueva');
    await screen.findByRole('form', { name: 'Datos de la promoción' });

    await user.type(screen.getByLabelText('Nombre'), 'Descuento Fijo Bs 2,50');

    // Cambiar tipo a monto fijo
    await user.selectOptions(screen.getByLabelText('Tipo de descuento'), 'monto_fijo');

    // Escribir monto 2,50
    await user.type(screen.getByLabelText('Monto (Bs)'), '2,50');

    // Elegir un producto
    await user.click(screen.getByLabelText('Cono simple'));

    // Enviar formulario
    await user.click(screen.getByRole('button', { name: 'Crear promoción' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith(
        'POST',
        '/promotions',
        expect.objectContaining({
          kind: 'monto_fijo',
          value: 250,
        }),
      ),
    );
  });

  it('muestra aviso en la vista previa si otra promoción vigente da mayor descuento', async () => {
    const { user } = open('/admin/promociones/nueva');
    await screen.findByRole('form', { name: 'Datos de la promoción' });

    // Elegir monto fijo de Bs 1,00 para Cono simple (precio 1000)
    await user.selectOptions(screen.getByLabelText('Tipo de descuento'), 'monto_fijo');
    await user.type(screen.getByLabelText('Monto (Bs)'), '1,00');

    // Elegir Cono simple (el seed fake ya tiene "Verano 20%", que da Bs 2,00 de descuento)
    await user.click(screen.getByLabelText('Cono simple'));

    // El aviso de competencia debe aparecer
    expect(
      await screen.findByText(/Aviso: La promoción vigente «Verano 20%» otorga un mayor descuento/),
    ).toBeVisible();
  });

  it('valida campos obligatorios y fechas en el cliente', async () => {
    const { user, api } = open('/admin/promociones/nueva');
    await screen.findByRole('form', { name: 'Datos de la promoción' });

    // Enviar vacío
    await user.click(screen.getByRole('button', { name: 'Crear promoción' }));

    expect(await screen.findByText('Ingresa el nombre')).toBeVisible();
    expect(screen.getByText('Ingresa el valor del descuento')).toBeVisible();
    expect(screen.getByText('Elige al menos un producto')).toBeVisible();
    expect(api.calls).not.toHaveBeenCalledWith('POST', '/promotions', expect.anything());

    // Fecha fin anterior a fecha inicio
    await user.clear(screen.getByLabelText('Inicio (hora de Bolivia)'));
    await user.type(screen.getByLabelText('Inicio (hora de Bolivia)'), '2026-12-31T20:00');
    await user.type(screen.getByLabelText('Fin (opcional)'), '2026-12-01T10:00');
    await user.click(screen.getByRole('button', { name: 'Crear promoción' }));

    expect(
      await screen.findByText('La fecha de fin debe ser posterior a la de inicio'),
    ).toBeVisible();
  });

  it('permite editar una promoción existente', async () => {
    const { user, api } = open('/admin/promociones/00000000-0000-4000-8000-0000000000p1');

    // Esperar a que cargue con los datos de "Verano 20%"
    const nameInput = await screen.findByLabelText('Nombre');
    expect(nameInput).toHaveValue('Verano 20%');
    expect(screen.getByLabelText('Porcentaje (%)')).toHaveValue('20');

    // Modificar nombre y desactivar
    await user.clear(nameInput);
    await user.type(nameInput, 'Verano 20% Modificado');

    const activeCheckbox = screen.getByLabelText('Promoción activa');
    expect(activeCheckbox).toBeChecked();
    await user.click(activeCheckbox);
    expect(activeCheckbox).not.toBeChecked();

    // Guardar
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith(
        'PATCH',
        '/promotions/00000000-0000-4000-8000-0000000000p1',
        expect.objectContaining({
          name: 'Verano 20% Modificado',
          isActive: false,
        }),
      ),
    );
  });
});
