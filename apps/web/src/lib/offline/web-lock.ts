/**
 * Ejecuta `fn` solo si nadie más tiene el candado `name`; si está tomado devuelve `{ acquired: false }`
 * sin esperar. Así una sola pestaña sincroniza la cola (SPEC-offline-print OP-D6).
 */
export type ExclusiveLock = <T>(
  name: string,
  fn: () => Promise<T>,
) => Promise<{ acquired: true; value: T } | { acquired: false }>;

/** Candado en memoria: cubre una sola pestaña (respaldo y pruebas). */
export function createMemoryLock(): ExclusiveLock {
  const held = new Set<string>();
  return async (name, fn) => {
    if (held.has(name)) return { acquired: false };
    held.add(name);
    try {
      return { acquired: true, value: await fn() };
    } finally {
      held.delete(name);
    }
  };
}

/** Web Locks API: el candado vale entre pestañas del mismo origen. Sin soporte, usa memoria. */
export function createWebLock(
  locks: LockManager | undefined = globalThis.navigator?.locks,
): ExclusiveLock {
  if (!locks) return createMemoryLock();
  return (name, fn) =>
    locks.request(name, { ifAvailable: true }, async (lock) => {
      if (!lock) return { acquired: false as const };
      return { acquired: true as const, value: await fn() };
    });
}
