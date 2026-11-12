import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api-client';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth, TEST_USERS } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open(api = createFakeApi()) {
  const result = renderApp('/admin/usuarios', createFakeAuth({ session: 'admin' }), api);
  return { ...result, user: userEvent.setup() };
}

const rowOf = async (email: string) => (await screen.findByText(email)).closest('tr')!;

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  values: { email?: string; password?: string; fullName?: string; role?: string },
) {
  await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
  const form = screen.getByRole('form', { name: 'Nuevo usuario' });
  if (values.fullName) await user.type(within(form).getByLabelText('Nombre'), values.fullName);
  if (values.email) await user.type(within(form).getByLabelText('Correo'), values.email);
  if (values.password) await user.type(within(form).getByLabelText('Contraseña'), values.password);
  if (values.role) await user.selectOptions(within(form).getByLabelText('Rol'), values.role);
  await user.click(within(form).getByRole('button', { name: 'Crear usuario' }));
  return form;
}

describe('UsersPage', () => {
  it('lista los usuarios con nombre, correo, rol y estado', async () => {
    open();
    const row = await rowOf(TEST_USERS.cocina.email);
    expect(within(row).getByText('Cocina de Prueba')).toBeVisible();
    expect(within(row).getByLabelText('Rol de Cocina de Prueba')).toHaveValue('cocina');
    expect(within(row).getByText('Activo')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
  });

  it('crea un usuario con los datos normalizados y lo muestra en la lista', async () => {
    const { user, api } = open();
    await screen.findByText(TEST_USERS.admin.email);
    await fillForm(user, {
      fullName: 'Ana Pérez',
      email: ' Ana@TusAntojos.test',
      password: 'clave-segura-1',
      role: 'cajero',
    });
    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('POST', '/users', {
        fullName: 'Ana Pérez',
        email: 'ana@tusantojos.test',
        password: 'clave-segura-1',
        role: 'cajero',
      }),
    );
    expect(await screen.findByText('ana@tusantojos.test')).toBeVisible();
    expect(await screen.findByText('Usuario creado')).toBeVisible();
    expect(screen.queryByRole('form', { name: 'Nuevo usuario' })).not.toBeInTheDocument();
  });

  it('valida en el cliente con el esquema compartido, sin llamar a la API', async () => {
    const { user, api } = open();
    await screen.findByText(TEST_USERS.admin.email);
    await fillForm(user, { fullName: 'Ana', email: 'ana@x.co', password: '123' });
    expect(await screen.findByText('Mínimo 8 caracteres')).toBeVisible();
    expect(api.calls).not.toHaveBeenCalledWith('POST', expect.anything(), expect.anything());
  });

  it('muestra los errores de validación del servidor en sus campos', async () => {
    const api = createFakeApi();
    const { user } = open(api);
    await screen.findByText(TEST_USERS.admin.email);
    api.failNext(
      new ApiError(
        400,
        'VALIDATION_ERROR',
        'Datos inválidos',
        [{ path: 'password', message: 'La contraseña es demasiado débil' }],
        'r',
      ),
    );
    await fillForm(user, { fullName: 'Ana', email: 'ana@x.co', password: '12345678' });
    expect(await screen.findByText('La contraseña es demasiado débil')).toBeVisible();
    expect(screen.getByRole('form', { name: 'Nuevo usuario' })).toBeVisible();
  });

  it('correo repetido (409) se muestra en el campo Correo', async () => {
    const api = createFakeApi();
    const { user } = open(api);
    await screen.findByText(TEST_USERS.admin.email);
    api.failNext(
      new ApiError(409, 'CONFLICT', 'Ya existe un usuario con ese correo', undefined, 'r'),
    );
    const form = await fillForm(user, {
      fullName: 'Ana',
      email: TEST_USERS.cajero.email,
      password: 'clave-segura-1',
    });
    expect(await within(form).findByText('Ya existe un usuario con ese correo')).toBeVisible();
    expect(within(form).getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true');
  });

  it('cambia el rol de otro usuario', async () => {
    const { user, api } = open();
    const row = await rowOf(TEST_USERS.cajero.email);
    await user.selectOptions(within(row).getByLabelText('Rol de Cajero de Prueba'), 'cocina');
    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('PATCH', `/users/${TEST_USERS.cajero.id}`, {
        role: 'cocina',
      }),
    );
    expect(await screen.findByText('Usuario actualizado')).toBeVisible();
  });

  it('desactiva y reactiva a otro usuario', async () => {
    const { user, api } = open();
    const row = await rowOf(TEST_USERS.cocina.email);
    await user.click(within(row).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith('PATCH', `/users/${TEST_USERS.cocina.id}`, {
        isActive: false,
      }),
    );
    expect(await within(row).findByText('Inactivo')).toBeVisible();
    await user.click(within(row).getByRole('button', { name: 'Activar' }));
    expect(await within(row).findByText('Activo')).toBeVisible();
  });

  it('en su propia fila, el admin no puede cambiar su rol ni desactivarse', async () => {
    open();
    const row = await rowOf(TEST_USERS.admin.email);
    expect(within(row).getByText('(tú)')).toBeVisible();
    expect(within(row).getByLabelText('Rol de Admin de Prueba')).toBeDisabled();
    expect(within(row).getByRole('button', { name: 'Desactivar' })).toBeDisabled();
  });

  it('un error de regla de negocio (LAST_ADMIN) se muestra y la fila vuelve a su valor', async () => {
    const api = createFakeApi();
    const { user } = open(api);
    const row = await rowOf(TEST_USERS.cocina.email);
    api.failNext(
      new ApiError(
        422,
        'BUSINESS_RULE',
        'Debe quedar al menos un administrador activo',
        { reason: 'LAST_ADMIN' },
        'r',
      ),
    );
    await user.selectOptions(within(row).getByLabelText('Rol de Cocina de Prueba'), 'cajero');
    expect(await screen.findByText('Debe quedar al menos un administrador activo')).toBeVisible();
    await waitFor(() =>
      expect(within(row).getByLabelText('Rol de Cocina de Prueba')).toHaveValue('cocina'),
    );
  });

  it('si la lista no carga, muestra un error con "Reintentar"', async () => {
    const api = createFakeApi();
    api.failNext(
      new ApiError(0, 'NETWORK', 'No se pudo conectar con el servidor', undefined, null),
    );
    api.failNext(
      new ApiError(0, 'NETWORK', 'No se pudo conectar con el servidor', undefined, null),
    );
    const { user } = open(api);
    expect(
      await screen.findByText('No se pudo cargar la lista de usuarios', {}, { timeout: 4000 }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(TEST_USERS.admin.email)).toBeVisible();
  });

  it('se llega desde Administración', async () => {
    const { user, router } = {
      ...renderApp('/admin', createFakeAuth({ session: 'admin' })),
      user: userEvent.setup(),
    };
    await user.click(await screen.findByRole('link', { name: /Usuarios/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/usuarios'));
  });

  it('cajero que entra a /admin/usuarios termina en /sin-acceso', async () => {
    const { router } = renderApp('/admin/usuarios', createFakeAuth({ session: 'cajero' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/sin-acceso'));
  });
});
