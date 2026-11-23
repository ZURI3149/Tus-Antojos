import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppRole } from '@tus-antojos/shared';
import { createFakeAuth, TEST_USERS } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

const HEADINGS: Record<string, string> = {
  '/caja': 'Caja',
  '/cocina': 'Cocina',
  '/admin': 'Administración',
};

async function expectPage(router: ReturnType<typeof renderApp>['router'], path: string) {
  await waitFor(() => expect(router.state.location.pathname).toBe(path));
  if (HEADINGS[path]) {
    expect(await screen.findByRole('heading', { level: 1, name: HEADINGS[path] })).toBeVisible();
  }
}

describe('redirección por rol', () => {
  it.each([
    ['cajero', '/caja'],
    ['cocina', '/cocina'],
    ['admin', '/admin'],
  ] as [AppRole, string][])('%s en "/" → %s', async (role, home) => {
    const { router } = renderApp('/', createFakeAuth({ session: role }));
    await expectPage(router, home);
  });

  it('muestra el logo de la marca en la barra de navegación con formato picture y clase contents', async () => {
    renderApp('/caja', createFakeAuth({ session: 'cajero' }));
    const logoImg = await screen.findByAltText('Logo Tus Antojos');
    expect(logoImg).toHaveAttribute('src', '/logo1.png');
    const picture = logoImg.closest('picture');
    expect(picture).not.toBeNull();
    expect(picture?.querySelector('source')).toHaveAttribute('srcset', '/logo1.webp');
    expect(picture).toHaveClass('contents');
  });

  it.each([
    ['cajero', '/caja'],
    ['cocina', '/cocina'],
    ['admin', '/admin'],
  ] as [AppRole, string][])('al iniciar sesión, %s llega a %s', async (role, home) => {
    const { router } = renderApp('/login', createFakeAuth());
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Correo electrónico'), TEST_USERS[role].email);
    await user.type(screen.getByLabelText('Contraseña'), 'x');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await expectPage(router, home);
  });
});

describe('rutas protegidas', () => {
  // [ruta, roles permitidos]
  const matrix: [string, AppRole[]][] = [
    ['/caja', ['cajero', 'admin']],
    ['/cocina', ['cocina', 'admin']],
    ['/admin', ['admin']],
  ];

  for (const [path, allowed] of matrix) {
    for (const role of ['cajero', 'cocina', 'admin'] as AppRole[]) {
      const ok = allowed.includes(role);
      it(`${role} → ${path} = ${ok ? 'entra' : '/sin-acceso'}`, async () => {
        const { router } = renderApp(path, createFakeAuth({ session: role }));
        if (ok) {
          await expectPage(router, path);
        } else {
          await expectPage(router, '/sin-acceso');
          expect(await screen.findByRole('heading', { name: 'Sin acceso' })).toBeVisible();
        }
      });
    }
  }

  it.each(['/', '/caja', '/cocina', '/admin', '/sin-acceso'])(
    'sin sesión, %s lleva a /login',
    async (path) => {
      const { router } = renderApp(path, createFakeAuth());
      await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    },
  );

  it('después de iniciar sesión vuelve a la página que se pidió', async () => {
    const { router } = renderApp('/cocina', createFakeAuth());
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Correo electrónico'), TEST_USERS.admin.email);
    await user.type(screen.getByLabelText('Contraseña'), 'x');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await expectPage(router, '/cocina');
  });

  it('un usuario desactivado ve el aviso y puede cerrar sesión', async () => {
    const fake = createFakeAuth({
      session: 'admin',
      profiles: {
        [TEST_USERS.admin.id]: {
          id: TEST_USERS.admin.id,
          role: 'admin',
          fullName: 'Admin',
          isActive: false,
        },
      },
    });
    const { router } = renderApp('/admin', fake);
    expect(await screen.findByRole('heading', { name: 'Usuario desactivado' })).toBeVisible();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('un usuario sin perfil ve el mismo aviso (no entra a ninguna pantalla)', async () => {
    const fake = createFakeAuth({ session: 'cajero', profiles: { [TEST_USERS.cajero.id]: null } });
    renderApp('/caja', fake);
    expect(await screen.findByRole('heading', { name: 'Usuario desactivado' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Caja' })).not.toBeInTheDocument();
  });

  it('si no se puede cargar el perfil, muestra un error con "Reintentar"', async () => {
    const fake = createFakeAuth({ session: 'cajero' });
    fake.mocks.fetchProfile.mockRejectedValue(new Error('sin red'));
    renderApp('/caja', fake);
    expect(
      await screen.findByRole(
        'heading',
        { name: 'No se pudo cargar tu perfil' },
        { timeout: 4000 },
      ),
    ).toBeVisible();
    fake.mocks.fetchProfile.mockReset();
    fake.mocks.fetchProfile.mockResolvedValue({
      id: TEST_USERS.cajero.id,
      role: 'cajero',
      fullName: 'Cajero de Prueba',
      isActive: true,
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Caja' })).toBeVisible();
  });
});

describe('barra de la aplicación', () => {
  it('muestra el nombre, el rol y solo los accesos permitidos', async () => {
    renderApp('/caja', createFakeAuth({ session: 'cajero' }));
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    expect(screen.getByText('Cajero de Prueba')).toBeVisible();
    expect(screen.getByText('Cajero', { selector: '[data-slot="role-badge"]' })).toBeVisible();
    expect(nav).toHaveTextContent('Caja');
    expect(nav).not.toHaveTextContent('Cocina');
    expect(nav).not.toHaveTextContent('Administración');
  });

  it('admin ve los tres accesos', async () => {
    renderApp('/admin', createFakeAuth({ session: 'admin' }));
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    for (const label of ['Caja', 'Cocina', 'Administración']) {
      expect(nav).toHaveTextContent(label);
    }
  });

  it('cerrar sesión desde cualquier pantalla vuelve a /login', async () => {
    const fake = createFakeAuth({ session: 'cocina' });
    const { router } = renderApp('/cocina', fake);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(fake.mocks.signOut).toHaveBeenCalled();
  });
});

describe('otras rutas', () => {
  it('"Página no encontrada" para rutas desconocidas', async () => {
    renderApp('/no-existe', createFakeAuth());
    expect(
      await screen.findByRole('heading', { name: 'Página no encontrada' }),
    ).toBeInTheDocument();
    const logo = screen.getByAltText('Logo Tus Antojos');
    expect(logo).toHaveAttribute('src', '/logo1.png');
  });

  it('/sin-acceso ofrece volver al inicio propio', async () => {
    renderApp('/sin-acceso', createFakeAuth({ session: 'cocina' }));
    expect(await screen.findByRole('link', { name: 'Ir a mi inicio' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
