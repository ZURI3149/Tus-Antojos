import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { SupabaseService } from './supabase.service.js';

function serviceWithFetch(fetchImpl: typeof fetch) {
  const client = createClient('http://supabase.test', 'service-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchImpl },
  });
  return new SupabaseService(client);
}

describe('SupabaseService.isDatabaseReachable', () => {
  it('true si la base responde', async () => {
    const service = serviceWithFetch(async () => new Response('[]', { status: 200 }));
    await expect(service.isDatabaseReachable()).resolves.toBe(true);
  });

  it('false si la base responde con error', async () => {
    const service = serviceWithFetch(
      async () => new Response(JSON.stringify({ message: 'caída' }), { status: 503 }),
    );
    await expect(service.isDatabaseReachable()).resolves.toBe(false);
  });

  it('false si la red falla', async () => {
    const service = serviceWithFetch(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(service.isDatabaseReachable()).resolves.toBe(false);
  });

  it('false si no responde dentro del tiempo límite', async () => {
    const service = serviceWithFetch(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const started = Date.now();
    await expect(service.isDatabaseReachable(100)).resolves.toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('envía la service role key (nunca debe usarse en el frontend)', async () => {
    let apikey: string | null = null;
    const service = serviceWithFetch(async (_input, init) => {
      apikey = new Headers(init?.headers).get('apikey');
      return new Response('[]', { status: 200 });
    });
    await service.isDatabaseReachable();
    expect(apikey).toBe('service-key');
  });
});
