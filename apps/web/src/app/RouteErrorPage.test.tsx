import * as Sentry from '@sentry/react';
import type * as SentryModule from '@sentry/react';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { RouteErrorPage } from './RouteErrorPage';

vi.mock('@sentry/react', async (importOriginal) => ({
  ...(await importOriginal<typeof SentryModule>()),
  captureException: vi.fn(),
}));

function Boom(): never {
  throw new Error('fallo al dibujar');
}

describe('RouteErrorPage', () => {
  it('un error al dibujar una ruta muestra "Algo salió mal" y se reporta a Sentry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const router = createMemoryRouter(
      [{ errorElement: <RouteErrorPage />, children: [{ path: '/', element: <Boom /> }] }],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Algo salió mal' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeVisible();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'fallo al dibujar' }),
    );
  });
});
