import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppRole } from '@tus-antojos/shared';
import { AppException } from '../common/app-exception.js';
import type { AuthenticatedRequest } from './auth-user.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';

/** Guard global, se ejecuta después de AuthGuard: aplica @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets)) return true;

    const allowed = this.reflector.getAllAndOverride<AppRole[] | undefined>(ROLES_KEY, targets);
    if (!allowed) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user || !allowed.includes(user.role)) throw new AppException('FORBIDDEN');
    return true;
  }
}
