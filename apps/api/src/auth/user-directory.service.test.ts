import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseService } from '../supabase/supabase.service.js';
import { UserDirectory } from './user-directory.service.js';

type Row = { role: 'cajero' | 'cocina' | 'admin'; is_active: boolean } | null;

function fakeSupabase(rows: Record<string, Row>, opts: { fail?: boolean } = {}) {
  const calls: string[] = [];
  const admin = {
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => {
            calls.push(id);
            if (opts.fail) return { data: null, error: { message: 'caída', code: 'XX000' } };
            return { data: rows[id] ?? null, error: null };
          },
        }),
      }),
    }),
  };
  return { service: { admin } as unknown as SupabaseService, calls };
}

describe('UserDirectory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('devuelve rol y estado del perfil', async () => {
    const { service } = fakeSupabase({ u1: { role: 'cocina', is_active: true } });
    await expect(new UserDirectory(service).getProfile('u1')).resolves.toEqual({
      role: 'cocina',
      isActive: true,
    });
  });

  it('null si el usuario no tiene perfil', async () => {
    const { service } = fakeSupabase({});
    await expect(new UserDirectory(service).getProfile('nadie')).resolves.toBeNull();
  });

  it('guarda el resultado 30 s y luego vuelve a consultar', async () => {
    const { service, calls } = fakeSupabase({ u1: { role: 'admin', is_active: true } });
    const directory = new UserDirectory(service);
    await directory.getProfile('u1');
    await directory.getProfile('u1');
    expect(calls).toHaveLength(1);

    vi.advanceTimersByTime(30_001);
    await directory.getProfile('u1');
    expect(calls).toHaveLength(2);
  });

  it('invalidate() fuerza una nueva consulta (lo usará el cambio de rol)', async () => {
    const { service, calls } = fakeSupabase({ u1: { role: 'admin', is_active: true } });
    const directory = new UserDirectory(service);
    await directory.getProfile('u1');
    directory.invalidate('u1');
    await directory.getProfile('u1');
    expect(calls).toHaveLength(2);
  });

  it('si la base falla lanza el error y no lo guarda en caché', async () => {
    const { service, calls } = fakeSupabase({}, { fail: true });
    const directory = new UserDirectory(service);
    await expect(directory.getProfile('u1')).rejects.toBeDefined();
    await expect(directory.getProfile('u1')).rejects.toBeDefined();
    expect(calls).toHaveLength(2);
  });
});
