import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from './env.schema.js';

const valid = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

describe('loadEnv', () => {
  it('aplica valores por defecto con el mínimo de variables', () => {
    const env = loadEnv(valid);
    expect(env).toMatchObject({
      nodeEnv: 'development',
      port: 3000,
      logLevel: 'info',
      corsOrigins: ['http://localhost:5173'],
      appVersion: '0.0.0-dev',
      supabase: {
        url: 'http://127.0.0.1:54321',
        serviceRoleKey: 'service-role-key',
        jwksUrl: 'http://127.0.0.1:54321/auth/v1/.well-known/jwks.json',
        jwtSecret: undefined,
        jwtIssuer: 'http://127.0.0.1:54321/auth/v1',
      },
      sentry: { dsn: undefined, environment: 'development' },
    });
  });

  it('lee y convierte las variables opcionales', () => {
    const env = loadEnv({
      ...valid,
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      CORS_ORIGINS: 'https://caja.tusantojos.com, https://admin.tusantojos.com',
      SUPABASE_JWKS_URL: 'https://example.supabase.co/jwks',
      SUPABASE_JWT_SECRET: 'secret',
      SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/1',
      SENTRY_ENVIRONMENT: 'staging',
      APP_VERSION: 'abc123',
    });
    expect(env.port).toBe(8080);
    expect(env.corsOrigins).toEqual([
      'https://caja.tusantojos.com',
      'https://admin.tusantojos.com',
    ]);
    expect(env.supabase.jwksUrl).toBe('https://example.supabase.co/jwks');
    expect(env.supabase.jwtSecret).toBe('secret');
    expect(env.sentry).toEqual({
      dsn: 'https://abc@o1.ingest.sentry.io/1',
      environment: 'staging',
    });
    expect(env.appVersion).toBe('abc123');
  });

  it('trata las variables vacías como ausentes', () => {
    const env = loadEnv({ ...valid, SENTRY_DSN: '', PORT: '' });
    expect(env.sentry.dsn).toBeUndefined();
    expect(env.port).toBe(3000);
  });

  it('falla nombrando cada variable requerida que falta', () => {
    expect(() => loadEnv({})).toThrow(EnvValidationError);
    try {
      loadEnv({});
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('SUPABASE_URL');
      expect(message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    }
  });

  it('falla con valores inválidos', () => {
    expect(() => loadEnv({ ...valid, SUPABASE_URL: 'no-es-url' })).toThrow(/SUPABASE_URL/);
    expect(() => loadEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadEnv({ ...valid, LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/);
  });

  it('no incluye valores secretos en el mensaje de error', () => {
    expect(() =>
      loadEnv({ SUPABASE_URL: 'mal', SUPABASE_SERVICE_ROLE_KEY: 'super-secreta' }),
    ).toThrow(expect.objectContaining({ message: expect.not.stringContaining('super-secreta') }));
  });
});
