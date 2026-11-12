import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';
import type { FetchProfile } from './profile';

/** Parte de `supabase.auth` que usa la web (permite un cliente falso en pruebas). */
export type AuthClient = Pick<
  SupabaseClient['auth'],
  'onAuthStateChange' | 'signInWithPassword' | 'signOut'
>;

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type SignInFailure = 'invalid_credentials' | 'network' | 'unknown';
export type SignInResult = { ok: true } | { ok: false; reason: SignInFailure };

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  fetchProfile: FetchProfile;
}

/** Dependencias externas de la sesión (Supabase en la app; falsas en pruebas). */
export interface AuthServices {
  auth: AuthClient;
  fetchProfile: FetchProfile;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth() debe usarse dentro de <AuthProvider>');
  return value;
}
