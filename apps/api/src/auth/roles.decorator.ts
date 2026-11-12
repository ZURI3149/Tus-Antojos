import { SetMetadata } from '@nestjs/common';
import type { AppRole } from '@tus-antojos/shared';

export const ROLES_KEY = 'auth:roles';

/**
 * Limita una ruta (o un controlador) a ciertos roles. El del método tiene
 * prioridad sobre el de la clase. Sin @Roles(), basta con estar autenticado.
 */
export const Roles = (...roles: [AppRole, ...AppRole[]]) => {
  if (roles.length === 0) throw new Error('@Roles() necesita al menos un rol');
  return SetMetadata(ROLES_KEY, roles);
};
