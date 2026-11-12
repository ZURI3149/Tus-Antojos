import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

describe('LoginPage', () => {
  async function fill(email: string, password: string) {
    const user = userEvent.setup();
    if (email) await user.type(screen.getByLabelText('Correo'), email);
    if (password) await user.type(screen.getByLabelText('Contraseña'), password);
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  }

  it('muestra el formulario con campos accesibles', async () => {
    renderApp('/login', createFakeAuth());
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });

  it('valida en el cliente con mensajes en español, sin llamar a Supabase', async () => {
    const fake = createFakeAuth();
    renderApp('/login', fake);
    await screen.findByLabelText('Correo');
    await fill('no-es-correo', '');
    expect(await screen.findByText('Ingresa un correo válido')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true');
    expect(fake.mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('credenciales inválidas → mensaje genérico (no revela cuál falló)', async () => {
    const fake = createFakeAuth();
    fake.mocks.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'x' },
    } as never);
    renderApp('/login', fake);
    await screen.findByLabelText('Correo');
    await fill('cajero@tusantojos.test', 'mala');
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('fallo de red → mensaje de conexión', async () => {
    const fake = createFakeAuth();
    fake.mocks.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' },
    } as never);
    renderApp('/login', fake);
    await screen.findByLabelText('Correo');
    await fill('cajero@tusantojos.test', 'x');
    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo conectar/);
  });

  it('credenciales válidas → envía el correo normalizado y sale del login', async () => {
    const fake = createFakeAuth();
    renderApp('/login', fake);
    await screen.findByLabelText('Correo');
    await fill('  Cajero@TusAntojos.test', 'TusAntojos-local-2026');
    await waitFor(() =>
      expect(fake.mocks.signInWithPassword).toHaveBeenCalledWith({
        email: 'cajero@tusantojos.test',
        password: 'TusAntojos-local-2026',
      }),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Caja' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
  });

  it('con sesión activa, /login redirige a la pantalla del rol', async () => {
    const { router } = renderApp('/login', createFakeAuth({ session: 'cajero' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/caja'));
  });

  it('ignora destinos "from" externos o al propio login (evita redirecciones abiertas)', async () => {
    const fake = createFakeAuth();
    const { router } = renderApp('/login', fake);
    await router.navigate('/login', { state: { from: '//sitio-malicioso.com' } });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Correo'), 'cocina@tusantojos.test');
    await user.type(screen.getByLabelText('Contraseña'), 'x');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cocina'));
  });
});
