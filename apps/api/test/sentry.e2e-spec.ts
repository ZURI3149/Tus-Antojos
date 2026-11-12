import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createTransport, parseEnvelope } from '@sentry/core';
import * as Sentry from '@sentry/nestjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { Public } from '../src/auth/public.decorator.js';
import { AppException } from '../src/common/app-exception.js';
import { APP_CONFIG } from '../src/config/config.module.js';
import { loadEnv } from '../src/config/env.schema.js';
import { initSentry } from '../src/observability/sentry.js';
import { SupabaseService } from '../src/supabase/supabase.service.js';

// PL-07: los errores 5xx llegan a Sentry (con release, entorno y requestId); los 4xx no.

@Public()
@Controller('sentry-prueba')
class CrashController {
  @Get('500')
  crash() {
    throw new Error('fallo de prueba para Sentry');
  }

  @Get('422')
  business() {
    throw new AppException('BUSINESS_RULE', undefined, { reason: 'X' });
  }
}

type SentEvent = {
  release?: string;
  environment?: string;
  tags?: Record<string, string>;
  exception?: { values?: { value?: string }[] };
};

describe('Sentry en la API', () => {
  let app: INestApplication;
  let rawEnvelopes: string[] = [];

  const events = (): SentEvent[] =>
    rawEnvelopes.flatMap((raw) => {
      const [, items] = parseEnvelope(raw);
      return items
        .filter(([header]) => header.type === 'event')
        .map(([, payload]) => payload as SentEvent);
    });

  const config = loadEnv({
    SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'test',
    LOG_LEVEL: 'silent',
    NODE_ENV: 'production',
    APP_VERSION: 'abc123',
    SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0',
    SENTRY_ENVIRONMENT: 'staging',
  });

  beforeAll(async () => {
    const enabled = initSentry(config, {
      // Transporte simulado: registra los envíos en lugar de mandarlos a Sentry.
      transport: (options) =>
        createTransport(options, async (req) => {
          rawEnvelopes.push(
            typeof req.body === 'string' ? req.body : new TextDecoder().decode(req.body),
          );
          return { statusCode: 200 };
        }),
    });
    expect(enabled).toBe(true);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [CrashController],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(config)
      .overrideProvider(SupabaseService)
      .useValue({ isDatabaseReachable: async () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    rawEnvelopes = [];
  });

  afterAll(async () => {
    await app.close();
    await Sentry.close(2000);
  });

  it('un 500 se envía con release, entorno y request_id, sin el token', async () => {
    await request(app.getHttpServer())
      .get('/sentry-prueba/500')
      .set('x-request-id', 'req-sentry-1')
      .set('authorization', 'Bearer jwt-que-no-debe-salir')
      .expect(500);
    await Sentry.flush(2000);

    expect(events()).toHaveLength(1);
    const [event] = events();
    expect(event?.exception?.values?.[0]?.value).toBe('fallo de prueba para Sentry');
    expect(event?.release).toBe('abc123');
    expect(event?.environment).toBe('staging');
    expect(event?.tags?.request_id).toBe('req-sentry-1');
    expect(rawEnvelopes.join('')).not.toContain('jwt-que-no-debe-salir');
  });

  it.each([
    ['422 (regla de negocio)', '/sentry-prueba/422', 422],
    ['404 (ruta inexistente)', '/no-existe', 404],
    ['401 (sin token)', '/users', 401],
  ])('un %s no se envía', async (_label, path, status) => {
    await request(app.getHttpServer()).get(path).expect(status);
    await Sentry.flush(2000);
    expect(events()).toEqual([]);
  });
});
