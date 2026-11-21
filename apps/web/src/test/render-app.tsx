import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/providers';
import { routes } from '@/app/router';
import { createFakeApi, type FakeApi } from './fake-api';
import type { FakeAuth } from './fake-auth';

/** Monta la app completa (providers + rutas) en `path`, con servicios falsos. */
export function renderApp(path: string, fake: FakeAuth, fakeApi: FakeApi = createFakeApi()) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AppProviders
      services={{
        ...fake.services,
        api: fakeApi.api,
        catalog: fakeApi.catalog.reader,
        productImages: fakeApi.catalog.images,
        inventory: fakeApi.inventory.reader,
      }}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, api: fakeApi };
}
