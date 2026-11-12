import type { AppRole } from '@tus-antojos/shared';
import type { Request } from 'express';

/** Usuario autenticado. El rol sale de `profiles` (misma fuente que RLS), no del JWT. */
export interface AuthUser {
  id: string;
  role: AppRole;
  email: string | null;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };
