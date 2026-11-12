import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { AppRole } from '@tus-antojos/shared';
import { createFakeAuth } from '@/test/fake-auth';
import { useAuth } from './auth-context';
import { AuthProvider } from './AuthProvider';

function setup(initial: AppRole | null) {
  const fake = createFakeAuth({ session: initial });
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider services={fake.services}>{children}</AuthProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => useAuth(), { wrapper });
  return { fake, queryClient, result };
}

describe('AuthProvider', () => {
  it('empieza en "loading" y pasa a "unauthenticated" sin sesión', async () => {
    const { result } = setup(null);
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(result.current.session).toBeNull();
  });

  it('recupera una sesión existente (sobrevive a recargar la página)', async () => {
    const { result } = setup('admin');
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.session?.user.email).toBe('admin@tusantojos.test');
  });

  it('signIn: credenciales inválidas → reason invalid_credentials', async () => {
    const { fake, result } = setup(null);
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    fake.mocks.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'Invalid' },
    } as never);
    await expect(result.current.signIn('a@b.co', 'mala')).resolves.toEqual({
      ok: false,
      reason: 'invalid_credentials',
    });
  });

  it('signIn: fallo de red → reason network', async () => {
    const { fake, result } = setup(null);
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    fake.mocks.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' },
    } as never);
    await expect(result.current.signIn('a@b.co', 'x')).resolves.toEqual({
      ok: false,
      reason: 'network',
    });
  });

  it('signIn: excepción lanzada (sin red) → reason network', async () => {
    const { fake, result } = setup(null);
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    fake.mocks.signInWithPassword.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(result.current.signIn('a@b.co', 'x')).resolves.toEqual({
      ok: false,
      reason: 'network',
    });
  });

  it('signIn correcto actualiza la sesión', async () => {
    const { result } = setup(null);
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    await act(async () => {
      await expect(result.current.signIn('cocina@tusantojos.test', 'x')).resolves.toEqual({
        ok: true,
      });
    });
    expect(result.current.status).toBe('authenticated');
    expect(result.current.session?.user.email).toBe('cocina@tusantojos.test');
  });

  it('signOut cierra la sesión y limpia la caché de TanStack Query', async () => {
    const { result, queryClient, fake } = setup('cajero');
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    queryClient.setQueryData(['datos-privados'], { secreto: 1 });

    await act(async () => {
      await result.current.signOut();
    });

    expect(fake.mocks.signOut).toHaveBeenCalled();
    expect(queryClient.getQueryData(['datos-privados'])).toBeUndefined();
    expect(result.current.status).toBe('unauthenticated');
  });

  it('un cierre de sesión externo (otra pestaña, token vencido) también limpia la caché', async () => {
    const { result, queryClient, fake } = setup('cajero');
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    queryClient.setQueryData(['datos-privados'], { secreto: 1 });

    act(() => fake.emitSignedOut());

    expect(result.current.status).toBe('unauthenticated');
    expect(queryClient.getQueryData(['datos-privados'])).toBeUndefined();
  });

  it('useAuth fuera del provider da un error claro', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
