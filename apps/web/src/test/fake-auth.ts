import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { AppRole } from '@tus-antojos/shared';
import { vi } from 'vitest';
import type { AuthClient } from '@/features/auth/auth-context';
import type { Profile } from '@/features/auth/profile';

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

/** Mismos ids y correos que supabase/seed.sql. */
export const TEST_USERS: Record<AppRole, { id: string; email: string; fullName: string }> = {
  cajero: {
    id: '00000000-0000-4000-a000-000000000001',
    email: 'cajero@tusantojos.test',
    fullName: 'Cajero de Prueba',
  },
  cocina: {
    id: '00000000-0000-4000-a000-000000000002',
    email: 'cocina@tusantojos.test',
    fullName: 'Cocina de Prueba',
  },
  admin: {
    id: '00000000-0000-4000-a000-000000000003',
    email: 'admin@tusantojos.test',
    fullName: 'Admin de Prueba',
  },
};

export function fakeSession(role: AppRole = 'cajero'): Session {
  const user = TEST_USERS[role];
  return {
    access_token: `access-token-${role}`,
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: user.id,
      email: user.email,
      app_metadata: { role },
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
  } as Session;
}

function defaultProfile(id: string): Profile | null {
  const entry = Object.entries(TEST_USERS).find(([, u]) => u.id === id);
  if (!entry) return null;
  const [role, user] = entry as [AppRole, (typeof TEST_USERS)[AppRole]];
  return { id, role, fullName: user.fullName, isActive: true };
}

interface FakeAuthOptions {
  /** Rol con sesión ya iniciada al cargar (simula una recarga de página). */
  session?: AppRole | null;
  /** Reemplaza el perfil que devuelve la base para un id (null = sin perfil). */
  profiles?: Record<string, Profile | null>;
}

/**
 * Servicios de auth falsos con el mismo contrato que supabase.auth:
 * onAuthStateChange emite INITIAL_SESSION al suscribirse.
 */
export function createFakeAuth({
  session: initialRole = null,
  profiles = {},
}: FakeAuthOptions = {}) {
  let session = initialRole ? fakeSession(initialRole) : null;
  const listeners = new Set<Listener>();
  const emit = (event: AuthChangeEvent) => listeners.forEach((l) => l(event, session));

  const auth = {
    onAuthStateChange: vi.fn((listener: Listener) => {
      listeners.add(listener);
      queueMicrotask(() => listener('INITIAL_SESSION', session));
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    }),
    signInWithPassword: vi.fn(async ({ email }: { email: string; password: string }) => {
      const role = (Object.keys(TEST_USERS) as AppRole[]).find(
        (r) => TEST_USERS[r].email === email,
      );
      if (!role) {
        return {
          data: { session: null, user: null },
          error: { name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'x' },
        };
      }
      session = fakeSession(role);
      emit('SIGNED_IN');
      return { data: { session, user: session.user }, error: null };
    }),
    signOut: vi.fn(async () => {
      session = null;
      emit('SIGNED_OUT');
      return { error: null };
    }),
  };

  const fetchProfile = vi.fn(async (id: string): Promise<Profile | null> =>
    id in profiles ? (profiles[id] ?? null) : defaultProfile(id),
  );

  return {
    services: { auth: auth as unknown as AuthClient, fetchProfile },
    mocks: { ...auth, fetchProfile },
    /** Simula un cierre de sesión externo (otra pestaña, token vencido). */
    emitSignedOut() {
      session = null;
      emit('SIGNED_OUT');
    },
  };
}

export type FakeAuth = ReturnType<typeof createFakeAuth>;
