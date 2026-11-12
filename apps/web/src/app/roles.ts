import type { AppRole } from '@tus-antojos/shared';

/** Pantalla de inicio de cada rol (a donde lleva "/"). */
export const HOME_BY_ROLE: Record<AppRole, string> = {
  cajero: '/caja',
  cocina: '/cocina',
  admin: '/admin',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  cajero: 'Cajero',
  cocina: 'Cocina',
  admin: 'Administrador',
};

/** Secciones de la app y quién puede entrar (debe coincidir con las rutas de router.tsx). */
export const SECTIONS = [
  { path: '/caja', label: 'Caja', roles: ['cajero', 'admin'] },
  { path: '/cocina', label: 'Cocina', roles: ['cocina', 'admin'] },
  { path: '/admin', label: 'Administración', roles: ['admin'] },
] as const satisfies readonly { path: string; label: string; roles: readonly AppRole[] }[];

/** Acepta solo rutas internas de la app como destino tras el login. */
export function safeRedirectTarget(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if (value === '/login' || value.startsWith('/login?')) return null;
  return value;
}
