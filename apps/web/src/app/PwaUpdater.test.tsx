import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaUpdater } from './PwaUpdater';

const sw = vi.hoisted(() => ({
  needRefresh: false,
  offlineReady: false,
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  updateServiceWorker: vi.fn(async () => undefined),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, sw.setNeedRefresh],
    offlineReady: [sw.offlineReady, sw.setOfflineReady],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}));

function renderUpdater() {
  return render(
    <>
      <Toaster />
      <PwaUpdater />
    </>,
  );
}

describe('PwaUpdater', () => {
  beforeEach(() => {
    sw.needRefresh = false;
    sw.offlineReady = false;
    vi.clearAllMocks();
  });

  it('no muestra nada si no hay novedades', () => {
    renderUpdater();
    expect(screen.queryByText(/nueva versión/i)).not.toBeInTheDocument();
  });

  it('avisa cuando la app queda lista sin conexión', async () => {
    sw.offlineReady = true;
    renderUpdater();
    expect(await screen.findByText('La app ya funciona sin conexión.')).toBeInTheDocument();
    expect(sw.setOfflineReady).toHaveBeenCalledWith(false);
  });

  it('actualiza solo cuando el usuario lo pide', async () => {
    sw.needRefresh = true;
    renderUpdater();
    expect(await screen.findByText('Hay una nueva versión de Tus Antojos.')).toBeInTheDocument();
    expect(sw.updateServiceWorker).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('permite posponer la actualización', async () => {
    sw.needRefresh = true;
    renderUpdater();
    await userEvent.click(await screen.findByRole('button', { name: 'Más tarde' }));
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false);
    expect(sw.updateServiceWorker).not.toHaveBeenCalled();
  });
});
