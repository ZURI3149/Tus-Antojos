import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { openOfflineDb } from '@/lib/offline/db';
import { createOutbox, type Outbox } from '@/lib/offline/outbox';
import { createSnapshotStore, type SnapshotStore } from '@/lib/offline/snapshots';
import { createBrowserTransport } from '@/lib/escpos/transports/browser';
import { createSimulatedTransport } from '@/lib/escpos/transports/simulated';
import type { PrinterTransport } from '@/lib/escpos/transports/types';
import { createFakeApi, type FakeApi } from './fake-api';
import type { FakeAuth } from './fake-auth';

export interface TestOffline {
  outbox: Outbox;
  snapshots: SnapshotStore;
}

/** Cola y copias offline vacías en una base IndexedDB propia (fake-indexeddb). */
export function createTestOffline(): TestOffline {
  const db = openOfflineDb({ name: `test-${crypto.randomUUID()}` });
  return { outbox: createOutbox(db), snapshots: createSnapshotStore(db) };
}

/** Monta la app completa (providers + rutas) en `path`, con servicios falsos. */
export function renderApp(
  path: string,
  fake: FakeAuth,
  fakeApi: FakeApi = createFakeApi(),
  // Cola y copias reales sobre fake-indexeddb, en una base propia por prueba.
  offline: TestOffline = createTestOffline(),
  // El navegador de las pruebas no abre el diálogo de impresión; la simulada guarda lo impreso.
  printers: PrinterTransport[] = [
    createBrowserTransport({ print: () => {} }),
    createSimulatedTransport(),
  ],
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders
      services={{
        ...fake.services,
        api: fakeApi.api,
        catalog: fakeApi.catalog.reader,
        productImages: fakeApi.catalog.images,
        inventory: fakeApi.inventory.reader,
        promotions: fakeApi.promotions.reader,
        orders: fakeApi.orders.reader,
        outbox: offline.outbox,
        snapshots: offline.snapshots,
        printers,
      }}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, api: fakeApi, outbox: offline.outbox, snapshots: offline.snapshots };
}
