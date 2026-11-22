import type { User } from '@tus-antojos/shared';
import { vi } from 'vitest';
import { ApiError, type ApiClient } from '@/lib/api-client';
import { TEST_USERS } from './fake-auth';
import { createFakeCatalog, NOT_HANDLED, type FakeCatalog } from './fake-catalog';
import { createFakeInventory, type FakeInventory } from './fake-inventory';
import { createFakeOrders, type FakeOrders } from './fake-orders';
import { createFakePromotions, type FakePromotions } from './fake-promotions';

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

/**
 * API falsa en memoria (/users y, vía `catalog`, las rutas del catálogo), con el mismo
 * contrato que createApiClient. El catálogo comparte datos con su lector falso.
 */
export function createFakeApi(
  users: User[] = seedUsers(),
  catalog: FakeCatalog = createFakeCatalog(),
  inventory: FakeInventory = createFakeInventory(catalog),
  promotions: FakePromotions = createFakePromotions(catalog),
  orders: FakeOrders = createFakeOrders(catalog, promotions),
) {
  const queue: ApiError[] = [];
  const handle = vi.fn(
    async (
      method: string,
      path: string,
      body?: unknown,
      headers?: Record<string, string>,
    ): Promise<unknown> => {
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
      const fromCatalog = catalog.handle(method, path, body);
      if (fromCatalog !== NOT_HANDLED) return fromCatalog;
      const fromInventory = inventory.handle(method, path, body);
      if (fromInventory !== NOT_HANDLED) return fromInventory;
      const fromPromotions = promotions.handle(method, path, body);
      if (fromPromotions !== NOT_HANDLED) return fromPromotions;
      const fromOrders = orders.handle(method, path, body, headers);
      if (fromOrders !== NOT_HANDLED) return fromOrders;
      throw new Error(`Ruta no simulada: ${method} ${path}`);
    },
  );

  const api: ApiClient = {
    get: (path, headers) =>
      headers !== undefined
        ? (handle('GET', path, undefined, headers) as never)
        : (handle('GET', path) as never),
    post: (path, body, headers) =>
      headers !== undefined
        ? (handle('POST', path, body, headers) as never)
        : (handle('POST', path, body) as never),
    patch: (path, body, headers) =>
      headers !== undefined
        ? (handle('PATCH', path, body, headers) as never)
        : (handle('PATCH', path, body) as never),
    put: (path, body, headers) =>
      headers !== undefined
        ? (handle('PUT', path, body, headers) as never)
        : (handle('PUT', path, body) as never),
    delete: (path, headers) =>
      headers !== undefined
        ? (handle('DELETE', path, undefined, headers) as never)
        : (handle('DELETE', path) as never),
  };

  return {
    api,
    calls: handle,
    users,
    catalog,
    inventory,
    promotions,
    orders,
    /** La próxima llamada falla con este error. */
    failNext(error: ApiError) {
      queue.push(error);
    },
  };
}

export type FakeApi = ReturnType<typeof createFakeApi>;
