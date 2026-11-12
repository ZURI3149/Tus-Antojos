import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { APP_CONFIG } from '../src/config/config.module.js';
import { loadEnv } from '../src/config/env.schema.js';
import { SupabaseService } from '../src/supabase/supabase.service.js';

const config = loadEnv({
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test',
  APP_VERSION: 'test-version',
  LOG_LEVEL: 'silent',
});

async function createApp(dbReachable: boolean): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .overrideProvider(SupabaseService)
    .useValue({ isDatabaseReachable: async () => dbReachable })
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('GET /health', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('200 con db ok cuando la base responde', async () => {
    app = await createApp(true);
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok', version: 'test-version' });
  });

  it('503 con db error cuando la base no responde', async () => {
    app = await createApp(false);
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(res.body).toEqual({ status: 'error', db: 'error', version: 'test-version' });
  });
});
