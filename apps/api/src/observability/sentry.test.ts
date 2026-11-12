import type { ErrorEvent } from '@sentry/nestjs';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env.schema.js';
import { initSentry, scrubEvent } from './sentry.js';

describe('initSentry', () => {
  it('sin SENTRY_DSN no se activa (la API funciona igual)', () => {
    const config = loadEnv({
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'k',
    });
    expect(initSentry(config)).toBe(false);
  });
});

describe('scrubEvent', () => {
  it('quita encabezados, cookies, cuerpo y datos personales de la petición', () => {
    const event = {
      request: {
        url: 'http://api/users',
        headers: {
          authorization: 'Bearer jwt-secreto',
          cookie: 'sb=cookie-secreta',
          apikey: 'clave-secreta',
          'x-request-id': 'req-1',
        },
        cookies: { sb: 'cookie-secreta' },
        data: '{"password":"secreta"}',
      },
      user: { id: 'u1', email: 'a@b.co', ip_address: '1.2.3.4' },
    } as unknown as ErrorEvent;

    const scrubbed = scrubEvent(event);
    const serialized = JSON.stringify(scrubbed);
    expect(serialized).not.toMatch(/secret[oa]|a@b\.co|1\.2\.3\.4/);
    expect(scrubbed.request?.headers).toEqual({ 'x-request-id': 'req-1' });
    expect(scrubbed.user).toEqual({ id: 'u1' });
  });

  it('no falla con eventos sin request ni user', () => {
    expect(scrubEvent({ message: 'x' } as ErrorEvent)).toEqual({ message: 'x' });
  });
});
