import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { openOfflineDb } from './db';
import { createOutbox, type Outbox } from './outbox';
import { backoffDelayMs, classifySendError, createSyncEngine } from './sync';
import type { NewOutboxEntry, OutboxEntry } from './types';
import { createMemoryLock } from './web-lock';

const CASHIER = '00000000-0000-4000-a000-000000000001';
const OTHER = '00000000-0000-4000-a000-000000000009';
const T0 = new Date('2026-11-22T19:00:00.000Z');

function newEntry(cashierId = CASHIER): NewOutboxEntry {
  return {
    body: {
      clientOrderId: crypto.randomUUID(),
      items: [{ productId: 'p1', quantity: 1, note: '' }],
      paymentMethod: 'efectivo',
      createdOfflineAt: '2026-11-22T14:59:00.000-04:00',
    },
    cashierId,
    cashierName: cashierId === CASHIER ? 'Cajero de Prueba' : 'Otro Cajero',
    charged: {
      lines: [],
      subtotalCents: 1000,
      discountCents: 0,
      totalCents: 1000,
      cashReceivedCents: 1000,
      changeCents: 0,
    },
  };
}

/** Cola en una base propia por prueba, con entradas encoladas en orden un minuto antes de T0. */
async function outboxWith(...entries: NewOutboxEntry[]): Promise<{
  outbox: Outbox;
  ids: string[];
}> {
  const outbox = createOutbox(openOfflineDb({ name: `test-${crypto.randomUUID()}` }));
  const ids: string[] = [];
  for (const [i, e] of entries.entries()) {
    await outbox.enqueue(e, new Date(T0.getTime() - 60_000 + i));
    ids.push(e.body.clientOrderId);
  }
  return { outbox, ids };
}

const networkError = () =>
  new ApiError(0, 'NETWORK', 'No se pudo conectar con el servidor', undefined, null);
const serverError = () => new ApiError(503, 'INTERNAL', 'Error del servidor', undefined, 'r1');
const unauthorized = () => new ApiError(401, 'UNAUTHENTICATED', 'Sesión vencida', undefined, 'r2');
const businessRule = () =>
  new ApiError(422, 'BUSINESS_RULE', 'raw', { reason: 'PRODUCT_INACTIVE' }, 'r3');
const conflict = () =>
  new ApiError(409, 'CONFLICT', 'La clave de idempotencia ya fue usada', undefined, 'r4');

function engine(
  outbox: Outbox,
  send: (entry: OutboxEntry) => Promise<void>,
  opts: { now?: Date; userId?: string | null } = {},
) {
  return createSyncEngine({
    outbox,
    send,
    now: () => opts.now ?? T0,
    lock: createMemoryLock(),
    getCurrentUserId: () => (opts.userId === undefined ? CASHIER : opts.userId),
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('backoffDelayMs', () => {
  it('duplica la espera desde 1 s y la limita a 60 s', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 10].map(backoffDelayMs)).toEqual([
      1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000,
    ]);
  });
});

describe('classifySendError', () => {
  it('red, timeout y 5xx son transitorios', () => {
    expect(classifySendError(networkError()).kind).toBe('transient');
    expect(classifySendError(serverError()).kind).toBe('transient');
    expect(classifySendError(new TypeError('Failed to fetch')).kind).toBe('transient');
  });

  it('401 pide esperar a que se renueve la sesión', () => {
    expect(classifySendError(unauthorized()).kind).toBe('unauthorized');
  });

  it('409, 422 y 400 van a revisión con el mensaje en español', () => {
    expect(classifySendError(businessRule())).toEqual({
      kind: 'rejected',
      error: 'El producto no está activo para la venta',
    });
    expect(classifySendError(conflict()).kind).toBe('rejected');
    expect(
      classifySendError(new ApiError(400, 'VALIDATION_ERROR', 'Datos inválidos', [], null)).kind,
    ).toBe('rejected');
  });
});

describe('sync.run', () => {
  it('envía en orden FIFO y quita cada entrada confirmada (201 o 200 por idempotencia)', async () => {
    const { outbox, ids } = await outboxWith(newEntry(), newEntry(), newEntry());
    const sent: string[] = [];

    const result = await engine(outbox, async (e) => {
      sent.push(e.clientOrderId);
    }).run();

    expect(sent).toEqual(ids);
    expect(await outbox.list()).toEqual([]);
    expect(result).toMatchObject({ sent: 3, reviewed: 0, stoppedBy: null });
  });

  it('envía el cuerpo exacto que se encoló', async () => {
    const entry = newEntry();
    const { outbox } = await outboxWith(entry);
    const bodies: unknown[] = [];

    await engine(outbox, async (e) => {
      bodies.push(e.body);
    }).run();

    expect(bodies).toEqual([entry.body]);
  });

  it('ante un error de red deja la entrada pendiente con espera creciente y no sigue con las demás', async () => {
    const { outbox, ids } = await outboxWith(newEntry(), newEntry());
    const send = vi.fn(async () => {
      throw networkError();
    });

    const result = await engine(outbox, send).run();

    expect(send).toHaveBeenCalledTimes(1);
    expect(result.stoppedBy).toBe('transient');
    expect(await outbox.get(ids[0]!)).toMatchObject({
      status: 'pendiente',
      attempts: 1,
      lastError: 'No se pudo conectar con el servidor',
      nextAttemptAt: '2026-11-22T19:00:01.000Z',
    });
    expect((await outbox.get(ids[1]!))?.attempts).toBe(0);
  });

  it('no reintenta antes de la hora programada y sí después', async () => {
    const { outbox, ids } = await outboxWith(newEntry());
    let fail = true;
    const send = vi.fn(async () => {
      if (fail) throw serverError();
    });

    await engine(outbox, send, { now: T0 }).run(); // falla: próximo intento T0 + 1 s
    fail = false;
    await engine(outbox, send, { now: new Date(T0.getTime() + 500) }).run();
    expect(send).toHaveBeenCalledTimes(1);

    await engine(outbox, send, { now: new Date(T0.getTime() + 1000) }).run();
    expect(send).toHaveBeenCalledTimes(2);
    expect(await outbox.get(ids[0]!)).toBeUndefined();
  });

  it('la segunda falla seguida espera 2 s', async () => {
    const { outbox, ids } = await outboxWith(newEntry());
    const send = async () => {
      throw networkError();
    };

    await engine(outbox, send, { now: T0 }).run();
    await engine(outbox, send, { now: new Date(T0.getTime() + 1000) }).run();

    expect(await outbox.get(ids[0]!)).toMatchObject({
      attempts: 2,
      nextAttemptAt: '2026-11-22T19:00:03.000Z',
    });
  });

  it('un 401 no cuenta como intento y pausa la sincronización', async () => {
    const { outbox, ids } = await outboxWith(newEntry(), newEntry());
    const send = vi.fn(async () => {
      throw unauthorized();
    });

    const result = await engine(outbox, send).run();

    expect(result.stoppedBy).toBe('unauthorized');
    expect(send).toHaveBeenCalledTimes(1);
    expect(await outbox.get(ids[0]!)).toMatchObject({ status: 'pendiente', attempts: 0 });
  });

  it('un 409 o 422 pasa la entrada a revisión y sigue con las siguientes', async () => {
    const { outbox, ids } = await outboxWith(newEntry(), newEntry(), newEntry());
    const send = vi.fn(async (e: OutboxEntry) => {
      if (e.clientOrderId === ids[0]) throw businessRule();
      if (e.clientOrderId === ids[1]) throw conflict();
    });

    const result = await engine(outbox, send).run();

    expect(result).toMatchObject({ sent: 1, reviewed: 2, stoppedBy: null });
    expect(await outbox.get(ids[0]!)).toMatchObject({
      status: 'por_revisar',
      lastError: 'El producto no está activo para la venta',
    });
    expect((await outbox.get(ids[1]!))?.status).toBe('por_revisar');
    expect(await outbox.get(ids[2]!)).toBeUndefined();
  });

  it('no vuelve a enviar las entradas que están por revisar', async () => {
    const { outbox, ids } = await outboxWith(newEntry());
    await outbox.markForReview(ids[0]!, 'Producto inactivo');
    const send = vi.fn(async () => {});

    await engine(outbox, send).run();

    expect(send).not.toHaveBeenCalled();
  });

  it('solo envía las entradas del cajero con sesión y cuenta las ajenas', async () => {
    const { outbox, ids } = await outboxWith(newEntry(OTHER), newEntry(CASHIER));
    const sent: string[] = [];

    const result = await engine(outbox, async (e) => {
      sent.push(e.clientOrderId);
    }).run();

    expect(sent).toEqual([ids[1]]);
    expect(result.otherCashier).toBe(1);
    expect((await outbox.get(ids[0]!))?.status).toBe('pendiente');
  });

  it('sin usuario con sesión no envía nada', async () => {
    const { outbox } = await outboxWith(newEntry());
    const send = vi.fn(async () => {});

    const result = await engine(outbox, send, { userId: null }).run();

    expect(send).not.toHaveBeenCalled();
    expect(result.stoppedBy).toBe('no_session');
  });

  it('dos ejecuciones simultáneas envían cada entrada una sola vez', async () => {
    const { outbox } = await outboxWith(newEntry(), newEntry());
    const send = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    const sync = engine(outbox, send);

    const [a, b] = await Promise.all([sync.run(), sync.run()]);

    expect(send).toHaveBeenCalledTimes(2);
    expect([a.stoppedBy, b.stoppedBy]).toContain('busy');
  });
});

describe('sync.start', () => {
  it('al arrancar devuelve a pendiente lo que quedó en envío y sincroniza', async () => {
    const { outbox, ids } = await outboxWith(newEntry());
    await outbox.markSending(ids[0]!);
    const sent: string[] = [];
    const sync = engine(outbox, async (e) => {
      sent.push(e.clientOrderId);
    });

    const stop = sync.start({ intervalMs: 60_000 });
    await vi.waitFor(() => expect(sent).toEqual(ids));
    stop();
  });

  it('sincroniza al recuperar la conexión (evento online)', async () => {
    const { outbox } = await outboxWith();
    const send = vi.fn(async () => {});
    const sync = engine(outbox, send);
    const stop = sync.start({ intervalMs: 60_000 });
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(0));

    const entry = newEntry();
    await outbox.enqueue(entry, T0);
    window.dispatchEvent(new Event('online'));

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    stop();
  });

  it('después de stop ya no escucha el evento online', async () => {
    const { outbox } = await outboxWith();
    const send = vi.fn(async () => {});
    const stop = engine(outbox, send).start({ intervalMs: 60_000 });
    stop();

    await outbox.enqueue(newEntry(), T0);
    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 20));

    expect(send).not.toHaveBeenCalled();
  });
});
