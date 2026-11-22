import { describe, expect, it } from 'vitest';
import { createMemoryLock, createWebLock } from './web-lock';

/** LockManager mínimo: `ifAvailable` entrega `null` si el nombre ya está tomado. */
function fakeLockManager(): LockManager {
  const held = new Set<string>();
  const request = async (
    name: string,
    options: LockOptions,
    callback: (lock: Lock | null) => unknown,
  ): Promise<unknown> => {
    if (options.ifAvailable && held.has(name)) return callback(null);
    held.add(name);
    try {
      return await callback({ name, mode: 'exclusive' } as Lock);
    } finally {
      held.delete(name);
    }
  };
  return { request, query: async () => ({ held: [], pending: [] }) } as unknown as LockManager;
}

const slow = (value: string) => () => new Promise<string>((r) => setTimeout(() => r(value), 5));

describe('createWebLock', () => {
  it('con Web Locks, una segunda ejecución simultánea no obtiene el candado', async () => {
    const lock = createWebLock(fakeLockManager());

    const [a, b] = await Promise.all([lock('sync', slow('a')), lock('sync', slow('b'))]);

    expect(a).toEqual({ acquired: true, value: 'a' });
    expect(b).toEqual({ acquired: false });
  });

  it('sin Web Locks usa el candado en memoria, y lo libera al terminar', async () => {
    const lock = createWebLock(undefined);

    expect(await lock('sync', slow('a'))).toEqual({ acquired: true, value: 'a' });
    expect(await lock('sync', slow('b'))).toEqual({ acquired: true, value: 'b' });
  });

  it('el candado en memoria se libera aunque la función falle', async () => {
    const lock = createMemoryLock();

    await expect(
      lock('sync', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await lock('sync', slow('ok'))).toEqual({ acquired: true, value: 'ok' });
  });
});
