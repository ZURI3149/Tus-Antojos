import { describe, expect, it } from 'vitest';
import { openOfflineDb } from './db';
import { createSnapshotStore } from './snapshots';

const fresh = () => createSnapshotStore(openOfflineDb({ name: `test-${crypto.randomUUID()}` }));

describe('snapshots', () => {
  it('sin copia guardada devuelve null', async () => {
    expect(await fresh().load('pos-catalog')).toBeNull();
  });

  it('guarda y devuelve los datos con la hora en que se guardaron', async () => {
    const store = fresh();
    const data = { products: [{ id: 'p1', name: 'Cono simple' }] };

    await store.save('pos-catalog', data, new Date('2026-11-22T19:30:00.000Z'));

    expect(await store.load('pos-catalog')).toEqual({
      key: 'pos-catalog',
      savedAt: '2026-11-22T19:30:00.000Z',
      data,
    });
  });

  it('una lectura nueva reemplaza la anterior', async () => {
    const store = fresh();
    await store.save('pos-catalog', { v: 1 }, new Date('2026-11-22T19:00:00.000Z'));
    await store.save('pos-catalog', { v: 2 }, new Date('2026-11-22T20:00:00.000Z'));

    expect(await store.load('pos-catalog')).toMatchObject({
      savedAt: '2026-11-22T20:00:00.000Z',
      data: { v: 2 },
    });
  });

  it('las claves no se mezclan', async () => {
    const store = fresh();
    await store.save('a', { v: 'a' });

    expect(await store.load('b')).toBeNull();
  });
});
