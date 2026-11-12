import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { createRemoteJWKSet } from 'jose';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.schema.js';
import { AuthGuard } from './auth.guard.js';
import { JWT_KEY_RESOLVER, JwtVerifier } from './jwt-verifier.js';
import { RolesGuard } from './roles.guard.js';
import { UserDirectory } from './user-directory.service.js';

@Module({
  providers: [
    {
      provide: JWT_KEY_RESOLVER,
      inject: [APP_CONFIG],
      // jose guarda el JWKS en caché y lo vuelve a pedir si llega un `kid` nuevo
      // (rotación de claves en Supabase).
      useFactory: (config: AppConfig) =>
        createRemoteJWKSet(new URL(config.supabase.jwksUrl), {
          timeoutDuration: 3_000,
          cooldownDuration: 30_000,
          cacheMaxAge: 10 * 60_000,
        }),
    },
    JwtVerifier,
    UserDirectory,
    // El orden importa: los guards globales se ejecutan en el orden en que se registran.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtVerifier, UserDirectory],
})
export class AuthModule {}
