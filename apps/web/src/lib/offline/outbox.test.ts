import { describe, expect, it } from 'vitest';
import { openOfflineDb } from './db';
import { createOutbox } from './outbox';
import type { ChargedSnapshot, NewOutboxEntry } from './types';

const CASHIER = '00000000-0000-4000-a000-000000000001';
const OTHER_CASHIER = '00000000-0000-4000-a000-000000000009';

/** Cada prueba usa su propia base para no compartir estado. */
function freshOutbox() {
  const name = `test-${crypto.randomUUID()}`;
  return { name, outbox: createOutbox(openOfflineDb({ name })) };
}

const charged: ChargedSnapshot = {
  lines: [
    {
      productId: 'p1',
      productName: 'Cono de frutilla',
      quantity: 2,
      unitPriceCents: 1000,
      promotionId: null,
      promotionName: null,
      unitDiscountCents: 0,
      lineTotalCents: 2000,
      note: '',
    },
  ],
  subtotalCents: 2000,
  discountCents: 0,
  totalCents: 2000,
  cashReceivedCents: 5000,
  changeCents: 3000,
};

function newEntry(overrides: Partial<NewOutboxEntry> = {}): NewOutboxEntry {
  const clientOrderId = crypto.randomUUID();
  return {
    body: {
      clientOrderId,
      items: [{ productId: 'p1', quantity: 2, note: '' }],
      paymentMethod: 'efectivo',
      createdOfflineAt: '2026-11-22T15:00:00.000-04:00',
    },
    cashierId: CASHIER,
    cashierName: 'Cajero de Prueba',
    charged,
    ...overrides,
  };
}

const at = (iso: string) => new Date(iso);

describe('outbox.enqueue', () => {
  it('guarda el cuerpo exacto, el cajero, la copia de lo cobrado y el estado inicial', async () => {
    const { outbox } = freshOutbox();
    const input = newEntry();

    const entry = await outbox.enqueue(input, at('2026-11-22T19:00:00.000Z'));

    expect(entry).toEqual({
      schemaVersion: 1,
      clientOrderId: input.body.clientOrderId,
      body: input.body,
      cashierId: CASHIER,
      cashierName: 'Cajero de Prueba',
      charged,
      enqueuedAt: '2026-11-22T19:00:00.000Z',
      attempts: 0,
      nextAttemptAt: '2026-11-22T19:00:00.000Z',
      status: 'pendiente',
      lastError: null,
    });
    expect(await outbox.get(input.body.clientOrderId)).toEqual(entry);
  });

  it('no duplica: encolar dos veces el mismo clientOrderId devuelve la entrada existente', async () => {
    const { outbox } = freshOutbox();
    const input = newEntry();

    const first = await outbox.enqueue(input, at('2026-11-22T19:00:00.000Z'));
    const second = await outbox.enqueue(input, at('2026-11-22T19:05:00.000Z'));

    expect(second).toEqual(first);
    expect(await outbox.list()).toHaveLength(1);
  });

  it('rechaza un cuerpo sin clientOrderId', async () => {
    const { outbox } = freshOutbox();
    const input = newEntry();
    input.body = { ...input.body, clientOrderId: '' };

    await expect(outbox.enqueue(input)).rejects.toThrow(/clientOrderId/);
  });
});

describe('outbox.list y countPending', () => {
  it('lista en orden FIFO por hora de encolado', async () => {
    const { outbox } = freshOutbox();
    const late = newEntry();
    const early = newEntry();
    const middle = newEntry();

    await outbox.enqueue(late, at('2026-11-22T19:03:00.000Z'));
    await outbox.enqueue(early, at('2026-11-22T19:01:00.000Z'));
    await outbox.enqueue(middle, at('2026-11-22T19:02:00.000Z'));

    const ids = (await outbox.list()).map((e) => e.clientOrderId);
    expect(ids).toEqual([
      early.body.clientOrderId,
      middle.body.clientOrderId,
      late.body.clientOrderId,
    ]);
  });

  it('cuenta pendientes y en envío, pero no los que están por revisar', async () => {
    const { outbox } = freshOutbox();
    const a = await outbox.enqueue(newEntry());
    const b = await outbox.enqueue(newEntry());
    const c = await outbox.enqueue(newEntry());

    await outbox.markSending(b.clientOrderId);
    await outbox.markForReview(c.clientOrderId, 'El producto no está activo para la venta');

    expect(await outbox.countPending()).toBe(2);
    expect((await outbox.get(a.clientOrderId))?.status).toBe('pendiente');
  });

  it('countPending puede filtrar por cajero', async () => {
    const { outbox } = freshOutbox();
    await outbox.enqueue(newEntry());
    await outbox.enqueue(newEntry({ cashierId: OTHER_CASHIER, cashierName: 'Otro' }));

    expect(await outbox.countPending(CASHIER)).toBe(1);
    expect(await outbox.countPending(OTHER_CASHIER)).toBe(1);
    expect(await outbox.countPending()).toBe(2);
  });
});

describe('outbox: cambios de estado', () => {
  it('markDone quita la entrada de la cola', async () => {
    const { outbox } = freshOutbox();
    const entry = await outbox.enqueue(newEntry());

    await outbox.markDone(entry.clientOrderId);

    expect(await outbox.get(entry.clientOrderId)).toBeUndefined();
  });

  it('scheduleRetry vuelve a pendiente, suma un intento y guarda el error y el próximo intento', async () => {
    const { outbox } = freshOutbox();
    const entry = await outbox.enqueue(newEntry());
    await outbox.markSending(entry.clientOrderId);

    await outbox.scheduleRetry(entry.clientOrderId, {
      error: 'No se pudo conectar con el servidor',
      nextAttemptAt: at('2026-11-22T19:00:02.000Z'),
    });

    expect(await outbox.get(entry.clientOrderId)).toMatchObject({
      status: 'pendiente',
      attempts: 1,
      lastError: 'No se pudo conectar con el servidor',
      nextAttemptAt: '2026-11-22T19:00:02.000Z',
    });
  });

  it('markForReview guarda el motivo y no suma intentos', async () => {
    const { outbox } = freshOutbox();
    const entry = await outbox.enqueue(newEntry());

    await outbox.markForReview(entry.clientOrderId, 'El producto no está activo para la venta');

    expect(await outbox.get(entry.clientOrderId)).toMatchObject({
      status: 'por_revisar',
      attempts: 0,
      lastError: 'El producto no está activo para la venta',
    });
  });

  it('retry devuelve una entrada por revisar a pendiente, lista para enviarse ya', async () => {
    const { outbox } = freshOutbox();
    const entry = await outbox.enqueue(newEntry(), at('2026-11-22T19:00:00.000Z'));
    await outbox.markForReview(entry.clientOrderId, 'Producto inactivo');

    await outbox.retry(entry.clientOrderId, at('2026-11-22T20:00:00.000Z'));

    expect(await outbox.get(entry.clientOrderId)).toMatchObject({
      status: 'pendiente',
      lastError: null,
      nextAttemptAt: '2026-11-22T20:00:00.000Z',
    });
  });

  it('resetInterrupted devuelve a pendiente las entradas que quedaron en envío', async () => {
    const { outbox } = freshOutbox();
    const a = await outbox.enqueue(newEntry());
    const b = await outbox.enqueue(newEntry());
    await outbox.markSending(a.clientOrderId);
    await outbox.markForReview(b.clientOrderId, 'Producto inactivo');

    const reset = await outbox.resetInterrupted();

    expect(reset).toBe(1);
    expect((await outbox.get(a.clientOrderId))?.status).toBe('pendiente');
    expect((await outbox.get(b.clientOrderId))?.status).toBe('por_revisar');
  });

  it('cambiar el estado de una entrada inexistente no falla ni crea nada', async () => {
    const { outbox } = freshOutbox();

    await outbox.markSending('no-existe');
    await outbox.markForReview('no-existe', 'x');

    expect(await outbox.list()).toEqual([]);
  });
});

describe('outbox.discard', () => {
  it('exige un motivo de 3 a 200 caracteres', async () => {
    const { outbox } = freshOutbox();
    const entry = await outbox.enqueue(newEntry());

    await expect(outbox.discard(entry.clientOrderId, '  ')).rejects.toThrow(/motivo/i);
    await expect(outbox.discard(entry.clientOrderId, 'x'.repeat(201))).rejects.toThrow(/motivo/i);
    expect(await outbox.get(entry.clientOrderId)).toBeDefined();
  });

  it('quita la entrada y devuelve lo descartado para registrarlo', async () => {
    const { outbox } = freshOutbox();
    const entry = await outbox.enqueue(newEntry());

    const discarded = await outbox.discard(entry.clientOrderId, '  Cobrado a mano  ');

    expect(discarded).toEqual({ entry, reason: 'Cobrado a mano' });
    expect(await outbox.get(entry.clientOrderId)).toBeUndefined();
  });
});

describe('outbox.subscribe', () => {
  it('avisa a los suscriptores después de cada cambio y deja de avisar al desuscribirse', async () => {
    const { outbox } = freshOutbox();
    let calls = 0;
    const unsubscribe = outbox.subscribe(() => {
      calls++;
    });

    const entry = await outbox.enqueue(newEntry());
    await outbox.markSending(entry.clientOrderId);
    unsubscribe();
    await outbox.markDone(entry.clientOrderId);

    expect(calls).toBe(2);
  });
});

describe('persistencia y migraciones', () => {
  it('las entradas sobreviven a cerrar y reabrir la base (recarga de la página)', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const db = openOfflineDb({ name });
    const entry = await createOutbox(db).enqueue(newEntry());
    (await db).close();

    const reopened = createOutbox(openOfflineDb({ name }));

    expect(await reopened.get(entry.clientOrderId)).toEqual(entry);
  });

  it('una migración de versión conserva y transforma las entradas existentes', async () => {
    const name = `test-${crypto.randomUUID()}`;
    const v1 = openOfflineDb({ name });
    const entry = await createOutbox(v1).enqueue(newEntry());
    (await v1).close();

    // Migración de prueba a v2: marca cada entrada con la versión nueva.
    const v2 = openOfflineDb({
      name,
      version: 2,
      migrations: {
        2: async (_db, tx) => {
          let cursor = await tx.objectStore('outbox').openCursor();
          while (cursor) {
            await cursor.update({ ...cursor.value, schemaVersion: 2 });
            cursor = await cursor.continue();
          }
        },
      },
    });

    const migrated = await createOutbox(v2).get(entry.clientOrderId);
    expect(migrated).toEqual({ ...entry, schemaVersion: 2 });
  });
});
