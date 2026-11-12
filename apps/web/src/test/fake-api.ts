import type { User } from '@tus-antojos/shared';
import { vi } from 'vitest';
import { ApiError, type ApiClient } from '@/lib/api-client';
import { TEST_USERS } from './fake-auth';

export function seedUsers(): User[] {
  return (Object.keys(TEST_USERS) as (keyof typeof TEST_USERS)[]).map((role) => ({
    id: TEST_USERS[role].id,
    email: TEST_USERS[role].email,
    fullName: TEST_USERS[role].fullName,
    role,
    isActive: true,
    createdAt: '2026-11-12T10:00:00.000Z',
    lastSignInAt: null,
  }));
}

/** API falsa en memoria para /users, con el mismo contrato que createApiClient. */
export function createFakeApi(users: User[] = seedUsers()) {
  const queue: ApiError[] = [];
  const handle = vi.fn(async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const next = queue.shift();
    if (next) throw next;
    if (method === 'GET' && path === '/users') return structuredClone(users);
    if (method === 'POST' && path === '/users') {
      const input = body as { email: string; fullName: string; role: User['role'] };
      const user: User = {
        id: crypto.randomUUID(),
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastSignInAt: null,
      };
      users.push(user);
      return user;
    }
    const match = path.match(/^\/users\/(.+)$/);
    if (method === 'PATCH' && match) {
      const user = users.find((u) => u.id === match[1]);
      if (!user) throw new ApiError(404, 'NOT_FOUND', 'Usuario no encontrado', undefined, 'r');
      Object.assign(user, body);
      return structuredClone(user);
    }
    throw new Error(`Ruta no simulada: ${method} ${path}`);
  });

  const api: ApiClient = {
    get: (path) => handle('GET', path) as never,
    post: (path, body) => handle('POST', path, body) as never,
    patch: (path, body) => handle('PATCH', path, body) as never,
  };

  return {
    api,
    calls: handle,
    users,
    /** La próxima llamada falla con este error. */
    failNext(error: ApiError) {
      queue.push(error);
    },
  };
}

export type FakeApi = ReturnType<typeof createFakeApi>;
