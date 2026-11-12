import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from './auth-user.js';

/** Usuario autenticado de la petición. No usar en rutas @Public(). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) {
      // Error de programación (ruta pública o guard ausente), no del cliente → 500.
      throw new Error('@CurrentUser() se usó en una ruta sin usuario autenticado');
    }
    return user;
  },
);
