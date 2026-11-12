import type { Session } from '@supabase/supabase-js';
import * as Sentry from '@sentry/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AuthContext,
  type AuthServices,
  type AuthStatus,
  type SignInFailure,
  type SignInResult,
} from './auth-context';

function classifySignInError(error: {
  name?: string;
  code?: string;
  status?: number;
}): SignInFailure {
  if (error.code === 'invalid_credentials') return 'invalid_credentials';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return 'network';
  return 'unknown';
}

export function AuthProvider({
  services: { auth, fetchProfile },
  children,
}: {
  services: AuthServices;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ status: AuthStatus; session: Session | null }>({
    status: 'loading',
    session: null,
  });

  useEffect(() => {
    // Supabase emite INITIAL_SESSION al suscribirse: restaura la sesión guardada.
    const { data } = auth.onAuthStateChange((event, session) => {
      setState({ status: session ? 'authenticated' : 'unauthenticated', session });
      // Sentry: solo el id del usuario (sin correo). No hace nada si Sentry no está activo.
      Sentry.setUser(session ? { id: session.user.id } : null);
      // Ningún dato de un usuario debe sobrevivir a su sesión (p. ej. caja compartida).
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [auth, queryClient]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      try {
        const { error } = await auth.signInWithPassword({ email, password });
        return error ? { ok: false, reason: classifySignInError(error) } : { ok: true };
      } catch {
        return { ok: false, reason: 'network' };
      }
    },
    [auth],
  );

  const signOut = useCallback(async () => {
    await auth.signOut();
    queryClient.clear();
  }, [auth, queryClient]);

  const value = useMemo(
    () => ({ ...state, signIn, signOut, fetchProfile }),
    [state, signIn, signOut, fetchProfile],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
