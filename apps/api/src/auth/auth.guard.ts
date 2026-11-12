import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../common/app-exception.js';
import type { AuthenticatedRequest } from './auth-user.js';
import { InvalidTokenError, JwtVerifier } from './jwt-verifier.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { UserDirectory } from './user-directory.service.js';

function extractBearerToken(header: string | undefined): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

/** Guard global: toda ruta exige un JWT válido de un usuario activo, salvo @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifier,
    private readonly directory: UserDirectory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(req.headers.authorization);
    if (!token) throw new AppException('UNAUTHENTICATED');

    let verified;
    try {
      verified = await this.verifier.verify(token);
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw new AppException('UNAUTHENTICATED', undefined, undefined, { cause: error });
      }
      throw error;
    }

    const profile = await this.directory.getProfile(verified.userId);
    if (!profile?.isActive) {
      throw new AppException('FORBIDDEN', 'Tu usuario no está activo');
    }

    req.user = { id: verified.userId, role: profile.role, email: verified.email };
    return true;
  }
}
