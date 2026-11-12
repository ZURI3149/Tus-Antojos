import { createTransport, parseEnvelope } from '@sentry/core';
import * as Sentry from '@sentry/react';
import { afterAll } from 'vitest';
import { parseWebEnv } from './env';
import { initWebSentry, scrubWebEvent } from './sentry';

const base = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_x',
  VITE_API_URL: 'http://localhost:3000',
};

describe('initWebSentry', () => {
  afterAll(async () => {
    await Sentry.close(1000);
  });

  it('sin VITE_SENTRY_DSN no se activa', () => {
    expect(initWebSentry(parseWebEnv(base))).toBe(false);
  });

  it('con DSN envía errores con release y entorno', async () => {
    const sent: string[] = [];
    const env = parseWebEnv({
      ...base,
      VITE_SENTRY_DSN: 'https://public@o0.ingest.sentry.io/0',
      VITE_SENTRY_ENVIRONMENT: 'staging',
      VITE_APP_VERSION: 'web-abc',
    });
    const enabled = initWebSentry(env, {
      transport: (options) =>
        createTransport(options, async (req) => {
          sent.push(typeof req.body === 'string' ? req.body : new TextDecoder().decode(req.body));
          return { statusCode: 200 };
        }),
    });
    expect(enabled).toBe(true);

    Sentry.captureException(new Error('fallo en la web'));
    await Sentry.flush(1000);

    const events = sent.flatMap((raw) =>
      parseEnvelope(raw)[1]
        .filter(([header]) => header.type === 'event')
        .map(([, payload]) => payload as { release?: string; environment?: string }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ release: 'web-abc', environment: 'staging' });
  });
});

describe('scrubWebEvent', () => {
  it('quita tokens de las URLs del evento y de las migas de navegación', () => {
    const event = scrubWebEvent({
      request: { url: 'http://app/#access_token=secreto-1&refresh_token=secreto-2&type=recovery' },
      breadcrumbs: [
        { category: 'navigation', data: { from: '/login', to: '/caja?token=secreto-3' } },
        { category: 'fetch', data: { url: 'http://api/users?apikey=secreto-4', method: 'GET' } },
      ],
      user: { id: 'u1', email: 'a@b.co' },
    } as unknown as Sentry.ErrorEvent);
    expect(JSON.stringify(event)).not.toMatch(/secreto|a@b\.co/);
    expect(event.request?.url).toContain('type=recovery');
    expect(event.user).toEqual({ id: 'u1' });
  });
});
