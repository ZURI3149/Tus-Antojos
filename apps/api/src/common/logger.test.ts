import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env.schema.js';
import { buildLoggerParams, REDACT_PATHS, resolveRequestId } from './logger.js';

const config = loadEnv({ SUPABASE_URL: 'http://localhost:54321', SUPABASE_SERVICE_ROLE_KEY: 'k' });

describe('resolveRequestId', () => {
  it('reutiliza un x-request-id válido', () => {
    expect(resolveRequestId('abc-123_DEF.9')).toBe('abc-123_DEF.9');
  });

  it.each([undefined, '', 'con espacios', 'x'.repeat(129), '<script>', ['a', 'b']])(
    'genera un UUID nuevo si el valor recibido es %j',
    (value) => {
      expect(resolveRequestId(value)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    },
  );
});

describe('redacción de datos sensibles', () => {
  function captureLogger() {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        lines.push(String(chunk));
        cb();
      },
    });
    const logger = pino({ redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }, stream);
    return { logger, output: () => lines.join('') };
  }

  it('oculta authorization, cookie y set-cookie', () => {
    const { logger, output } = captureLogger();
    logger.info({
      req: { headers: { authorization: 'Bearer secreto-jwt', cookie: 'sb=secreto-cookie' } },
      res: { headers: { 'set-cookie': 'sb=secreto-set-cookie' } },
    });
    expect(output()).not.toMatch(/secreto/);
    expect(output()).toContain('[REDACTED]');
  });

  it('oculta campos password y token hasta dos niveles de profundidad', () => {
    const { logger, output } = captureLogger();
    logger.info({
      password: 'secreto-1',
      token: 'secreto-2',
      body: { password: 'secreto-3', access_token: 'secreto-4', refresh_token: 'secreto-5' },
      user: { credentials: { password: 'secreto-6', token: 'secreto-7' } },
    });
    expect(output()).not.toMatch(/secreto/);
  });
});

describe('buildLoggerParams', () => {
  it('usa el nivel configurado y no usa pino-pretty si hay destino propio', () => {
    const destination = new Writable({ write: (_c, _e, cb) => cb() });
    const params = buildLoggerParams({ ...config, logLevel: 'warn' }, destination);
    const [options, stream] = params.pinoHttp as [Record<string, unknown>, unknown];
    expect(options.level).toBe('warn');
    expect(options.transport).toBeUndefined();
    expect(stream).toBe(destination);
  });

  it('usa pino-pretty solo en desarrollo', () => {
    const dev = buildLoggerParams({ ...config, nodeEnv: 'development' }, null).pinoHttp as {
      transport?: { target: string };
    };
    const prod = buildLoggerParams({ ...config, nodeEnv: 'production' }, null).pinoHttp as {
      transport?: unknown;
    };
    expect(dev.transport?.target).toBe('pino-pretty');
    expect(prod.transport).toBeUndefined();
  });
});

describe('nivel de log según la respuesta', () => {
  const options = buildLoggerParams(config, null).pinoHttp as {
    customLogLevel: (req: unknown, res: { statusCode: number }, err?: Error) => string;
  };

  it.each([
    [200, undefined, 'info'],
    [302, undefined, 'info'],
    [401, undefined, 'warn'],
    [422, undefined, 'warn'],
    [500, undefined, 'error'],
    [200, new Error('x'), 'error'],
  ])('status %i (error: %s) → %s', (statusCode, err, level) => {
    expect(options.customLogLevel({}, { statusCode }, err)).toBe(level);
  });
});
