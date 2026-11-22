import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PRINTER_SETTINGS, savePrinterSettings } from '@/lib/escpos/printer';
import { createBrowserTransport } from '@/lib/escpos/transports/browser';
import { readSimulatedPrints } from '@/lib/escpos/transports/simulated';
import type { PrinterTransport } from '@/lib/escpos/transports/types';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { createTestOffline, renderApp } from '@/test/render-app';

/** Simula la red del navegador (jsdom siempre dice estar en línea). */
function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => {
  setOnline(true);
  localStorage.clear();
});

const useSimulated = (patch: Partial<typeof DEFAULT_PRINTER_SETTINGS> = {}) =>
  savePrinterSettings({ ...DEFAULT_PRINTER_SETTINGS, transport: 'simulada', ...patch });

async function sellCono(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Agregar Cono simple al pedido/i }));
  await user.click(
    within(screen.getByLabelText('Carrito de pedido actual')).getByRole('button', {
      name: /Cobrar/i,
    }),
  );
  await user.click(screen.getByRole('button', { name: 'Bs 20' }));
  await user.click(screen.getByRole('button', { name: 'Confirmar y Entregar' }));
}

const printedText = () => readSimulatedPrints().map((p) => p.text.join('\n'));

describe('imprimir al cobrar (OP11)', () => {
  it('con impresión automática, cada venta en línea imprime su ticket con número, total y cambio', async () => {
    useSimulated();
    renderApp('/caja', createFakeAuth({ session: 'cajero' }), createFakeApi());
    const user = userEvent.setup();

    await sellCono(user);

    await waitFor(() => expect(readSimulatedPrints()).toHaveLength(1));
    const [ticket] = printedText();
    expect(ticket).toMatch(/PEDIDO #\d+/);
    expect(ticket).toMatch(/TOTAL\s+Bs 8,00/);
    expect(ticket).toMatch(/Recibido\s+Bs 20,00/);
    expect(ticket).toMatch(/Cambio\s+Bs 12,00/);
    expect(ticket).toContain('Cajero: Cajero de Prueba');
  });

  it('una venta sin red imprime el ticket provisional (OFF-XXXX) con la leyenda de sincronización', async () => {
    useSimulated();
    renderApp('/caja', createFakeAuth({ session: 'cajero' }), createFakeApi(), createTestOffline());
    const user = userEvent.setup();
    // Primero carga el catálogo con red; después se corta.
    await screen.findByRole('button', { name: /Agregar Cono simple al pedido/i });
    setOnline(false);

    await sellCono(user);

    await waitFor(() => expect(readSimulatedPrints()).toHaveLength(1));
    expect(printedText()[0]).toMatch(/PEDIDO OFF-[0-9A-F]{4}/);
    expect(printedText()[0]).toContain('PENDIENTE DE SINCRONIZAR');
  });

  it('sin impresión automática no imprime', async () => {
    useSimulated({ autoPrint: false });
    renderApp('/caja', createFakeAuth({ session: 'cajero' }), createFakeApi());
    const user = userEvent.setup();

    await sellCono(user);

    expect((await screen.findAllByText(/registrado con éxito/)).length).toBeGreaterThan(0);
    expect(readSimulatedPrints()).toHaveLength(0);
  });

  it('si la impresora falla, la venta queda registrada y se ofrece reintentar o imprimir con el navegador', async () => {
    useSimulated();
    const browserPrint = vi.fn();
    let failures = 1;
    const flaky: PrinterTransport = {
      id: 'simulada',
      label: 'Impresora que falla',
      isAvailable: () => true,
      print: async () => {
        if (failures-- > 0) throw new Error('La impresora no responde');
      },
    };
    const api = createFakeApi();
    renderApp('/caja', createFakeAuth({ session: 'cajero' }), api, createTestOffline(), [
      createBrowserTransport({ print: browserPrint }),
      flaky,
    ]);
    const user = userEvent.setup();

    await sellCono(user);

    // La venta se registró igual.
    await waitFor(() =>
      expect(api.calls).toHaveBeenCalledWith(
        'POST',
        '/orders',
        expect.anything(),
        expect.anything(),
      ),
    );
    expect(await screen.findByText(/No se pudo imprimir el ticket/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Imprimir con el navegador' }));
    await waitFor(() => expect(browserPrint).toHaveBeenCalledTimes(1));
  });
});

describe('reimprimir desde /caja/pedidos (OP11)', () => {
  it('reimprime el ticket de un pedido del día con la leyenda REIMPRESIÓN', async () => {
    useSimulated();
    renderApp('/caja/pedidos', createFakeAuth({ session: 'cajero' }), createFakeApi());
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Reimprimir pedido #1' }));

    await waitFor(() => expect(readSimulatedPrints()).toHaveLength(1));
    expect(printedText()[0]).toContain('PEDIDO #1');
    expect(printedText()[0]).toContain('REIMPRESIÓN');
  });
});
