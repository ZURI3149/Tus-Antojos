import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { createTestOffline, renderApp } from '@/test/render-app';
import { POS_CATALOG_SNAPSHOT_KEY, type PosCatalogData } from './use-pos-catalog';

/** Simula la red del navegador (jsdom siempre dice estar en línea). */
function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => {
  setOnline(true);
});

/** Copia guardada con un producto renombrado, para saber que la grilla vino de la copia. */
async function savedCatalog(api: ReturnType<typeof createFakeApi>): Promise<PosCatalogData> {
  const products = await api.catalog.reader.products();
  return {
    categories: await api.catalog.reader.categories(),
    products: products.map((p) =>
      p.name === 'Cono simple' ? { ...p, name: 'Cono de la copia guardada' } : p,
    ),
    promotions: await api.promotions.reader.promotions(),
  };
}

function failingReaders(api: ReturnType<typeof createFakeApi>) {
  const fail = () => Promise.reject(new Error('Failed to fetch'));
  api.catalog.reader.products = fail;
  api.catalog.reader.categories = fail;
  api.promotions.reader.promotions = fail;
}

describe('catálogo de la caja sin red (OP5)', () => {
  it('sin red y con copia guardada, la grilla usa la copia y muestra su fecha', async () => {
    const api = createFakeApi();
    const offline = createTestOffline();
    await offline.snapshots.save(
      POS_CATALOG_SNAPSHOT_KEY,
      await savedCatalog(api),
      new Date('2026-11-22T13:05:00.000Z'), // 09:05 en Bolivia
    );
    // Sin red real, las lecturas de Supabase fallan (los lectores falsos responderían igual).
    failingReaders(api);
    setOnline(false);

    renderApp('/caja', createFakeAuth({ session: 'cajero' }), api, offline);

    expect(await screen.findByText('Cono de la copia guardada')).toBeVisible();
    expect(screen.getByText(/Catálogo del 22\/11 09:05/)).toBeVisible();
  });

  it('con red pero sin respuesta del catálogo, usa la copia guardada', async () => {
    const api = createFakeApi();
    const offline = createTestOffline();
    await offline.snapshots.save(POS_CATALOG_SNAPSHOT_KEY, await savedCatalog(api));
    failingReaders(api);

    renderApp('/caja', createFakeAuth({ session: 'cajero' }), api, offline);

    expect(
      await screen.findByText('Cono de la copia guardada', undefined, { timeout: 5000 }),
    ).toBeVisible();
    expect(screen.getByText(/Catálogo del/)).toBeVisible();
  });

  it('sin red y sin copia, pide conectarse una vez en vez de mostrar una grilla vacía', async () => {
    const api = createFakeApi();
    failingReaders(api);
    setOnline(false);

    renderApp('/caja', createFakeAuth({ session: 'cajero' }), api, createTestOffline());

    expect(
      await screen.findByText(/Conéctate a internet una vez para cargar el catálogo/),
    ).toBeVisible();
    expect(screen.queryByText('No se encontraron productos')).toBeNull();
  });

  it('con red, muestra los datos frescos sin aviso de fecha y los guarda como copia', async () => {
    const offline = createTestOffline();

    renderApp('/caja', createFakeAuth({ session: 'cajero' }), createFakeApi(), offline);

    expect(await screen.findByText('Cono simple')).toBeVisible();
    expect(screen.queryByText(/Catálogo del/)).toBeNull();
    await waitFor(async () => {
      const saved = await offline.snapshots.load<PosCatalogData>(POS_CATALOG_SNAPSHOT_KEY);
      expect(saved?.data.products.map((p) => p.name)).toContain('Cono simple');
    });
  });
});
