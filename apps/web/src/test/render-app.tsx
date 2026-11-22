import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { openOfflineDb } from '@/lib/offline/db';
import { createOutbox, type Outbox } from '@/lib/offline/outbox';
import { createFakeApi, type FakeApi } from './fake-api';
import type { FakeAuth } from './fake-auth';

/** Cola offline vacía en una base IndexedDB propia (fake-indexeddb). */
export function createTestOutbox(): Outbox {
  return createOutbox(openOfflineDb({ name: `test-${crypto.randomUUID()}` }));
}

/** Monta la app completa (providers + rutas) en `path`, con servicios falsos. */
export function renderApp(
  path: string,
  fake: FakeAuth,
  fakeApi: FakeApi = createFakeApi(),
  // Cola real sobre fake-indexeddb, en una base propia por prueba.
  outbox: Outbox = createTestOutbox(),
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
        outbox,
      }}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, api: fakeApi, outbox };
}
