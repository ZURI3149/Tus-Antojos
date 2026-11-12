import { Writable } from 'node:stream';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { APP_CONFIG, LOG_DESTINATION } from '../src/config/config.module.js';
import { loadEnv } from '../src/config/env.schema.js';
import { SupabaseService } from '../src/supabase/supabase.service.js';

// PL-05 (requestId en respuesta y log) y PL-06 (sin datos sensibles en logs).
describe('logs de peticiones', () => {
  let app: INestApplication;
  let lines: string[] = [];

  const capture = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });

  const logs = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(APP_CONFIG)
      .useValue(
        loadEnv({
          SUPABASE_URL: 'http://127.0.0.1:54321',
          SUPABASE_SERVICE_ROLE_KEY: 'test',
          NODE_ENV: 'test',
          LOG_LEVEL: 'info',
        }),
      )
      .overrideProvider(LOG_DESTINATION)
      .useValue(capture)
      .overrideProvider(SupabaseService)
      .useValue({ isDatabaseReachable: async () => true })
      .compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    await app.init();
  });

  beforeEach(() => {
    lines = [];
  });

  afterAll(async () => {
    await app.close();
  });

  it('devuelve el x-request-id recibido y lo registra como requestId', async () => {
    const res = await request(app.getHttpServer())
      .get('/no-existe')
      .set('x-request-id', 'req-abc-123')
      .expect(404);
    expect(res.headers['x-request-id']).toBe('req-abc-123');
    expect(logs().some((log) => log.requestId === 'req-abc-123')).toBe(true);
  });

  it('genera un x-request-id si no viene uno', async () => {
    const res = await request(app.getHttpServer()).get('/no-existe').expect(404);
    const id = res.headers['x-request-id'];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(logs().some((log) => log.requestId === id)).toBe(true);
  });

  it('no registra authorization ni cookie', async () => {
    await request(app.getHttpServer())
      .get('/no-existe')
      .set('authorization', 'Bearer jwt-super-secreto')
      .set('cookie', 'sb-access-token=cookie-super-secreta');
    const output = lines.join('');
    expect(output).not.toContain('jwt-super-secreto');
    expect(output).not.toContain('cookie-super-secreta');
    expect(output).toContain('[REDACTED]');
  });

  it('registra los 4xx con nivel warn', async () => {
    await request(app.getHttpServer()).get('/no-existe').set('x-request-id', 'nivel-404');
    const completed = logs().filter((log) => log.msg === 'request completed');
    expect(completed.find((log) => log.requestId === 'nivel-404')?.level).toBe(40);
  });

  it('no registra las peticiones a /health (sondeos de la plataforma)', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    expect(
      logs().filter((log) => (log.req as { url?: string } | undefined)?.url === '/health'),
    ).toEqual([]);
  });
});
