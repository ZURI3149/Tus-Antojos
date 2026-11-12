import { Inject, Injectable } from '@nestjs/common';
import {
  decodeProtectedHeader,
  errors,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
  type JWTVerifyOptions,
} from 'jose';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.schema.js';

/** Token de la fuente de claves públicas (JWKS de Supabase; en pruebas, un JWKS local). */
export const JWT_KEY_RESOLVER = Symbol('JWT_KEY_RESOLVER');

/** El token no es válido (firma, vencimiento, emisor, audiencia, formato). → 401. */
export class InvalidTokenError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'InvalidTokenError';
  }
}

export interface VerifiedToken {
  userId: string;
  email: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASYMMETRIC_ALGORITHMS = ['ES256', 'RS256'];

@Injectable()
export class JwtVerifier {
  private readonly sharedSecret: Uint8Array | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(JWT_KEY_RESOLVER) private readonly getKey: JWTVerifyGetKey,
  ) {
    const secret = config.supabase.jwtSecret;
    this.sharedSecret = secret ? new TextEncoder().encode(secret) : undefined;
  }

  /**
   * Verifica un access token de Supabase Auth.
   * - ES256/RS256 con el JWKS del proyecto (por defecto).
   * - HS256 solo si SUPABASE_JWT_SECRET está configurado: así un token HS256
   *   nunca se verifica con una clave pública (confusión de algoritmo).
   * Lanza InvalidTokenError si el token no sirve; cualquier otro error (p. ej. el
   * JWKS no responde) se propaga tal cual para que termine en 500 y no en 401.
   */
  async verify(token: string): Promise<VerifiedToken> {
    const options: JWTVerifyOptions = {
      issuer: this.config.supabase.jwtIssuer,
      audience: 'authenticated',
      requiredClaims: ['sub', 'exp'],
    };

    let alg: string | undefined;
    try {
      ({ alg } = decodeProtectedHeader(token));
    } catch (error) {
      // jose lanza TypeError (no JOSEError) si el texto ni siquiera tiene forma de JWT.
      throw new InvalidTokenError('El token no tiene formato JWT', { cause: error });
    }

    let payload: JWTPayload;
    try {
      if (alg === 'HS256') {
        if (!this.sharedSecret) throw new InvalidTokenError('HS256 no está habilitado');
        ({ payload } = await jwtVerify(token, this.sharedSecret, {
          ...options,
          algorithms: ['HS256'],
        }));
      } else {
        ({ payload } = await jwtVerify(token, this.getKey, {
          ...options,
          algorithms: ASYMMETRIC_ALGORITHMS,
        }));
      }
    } catch (error) {
      if (error instanceof InvalidTokenError) throw error;
      const isTokenProblem =
        error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout);
      if (isTokenProblem) throw new InvalidTokenError('Token inválido', { cause: error });
      throw error;
    }

    if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) {
      throw new InvalidTokenError('El token no identifica a un usuario');
    }
    const email = typeof payload.email === 'string' && payload.email ? payload.email : null;
    return { userId: payload.sub, email };
  }
}
