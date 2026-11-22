import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserTransport } from './browser';
import { createSimulatedTransport, readSimulatedPrints } from './simulated';

const job = {
  bytes: Uint8Array.from([0x1b, 0x40, 0x41]),
  text: ['   TUS ANTOJOS', 'Cono de frutilla      Bs 8,00'],
  columns: 48 as const,
};

afterEach(() => {
  document.body.innerHTML = '';
  delete (window as { __tusAntojosPrints?: unknown }).__tusAntojosPrints;
});

describe('transporte "navegador"', () => {
  it('imprime el texto del ticket en un iframe oculto con la plantilla de 80 mm y lo quita', async () => {
    let printedHtml = '';
    const print = vi.fn((win: Window) => {
      printedHtml = win.document.documentElement.outerHTML;
    });
    const transport = createBrowserTransport({ print });

    await transport.print(job);

    expect(print).toHaveBeenCalledTimes(1);
    expect(printedHtml).toContain('Cono de frutilla      Bs 8,00');
    expect(printedHtml).toContain('size: 80mm auto');
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });

  it('en papel de 58 mm usa la plantilla de 58 mm', async () => {
    let printedHtml = '';
    const transport = createBrowserTransport({
      print: (win) => {
        printedHtml = win.document.documentElement.outerHTML;
      },
    });

    await transport.print({ ...job, columns: 32 });

    expect(printedHtml).toContain('size: 58mm auto');
  });

  it('escapa el HTML del contenido', async () => {
    let body = '';
    const transport = createBrowserTransport({
      print: (win) => {
        body = win.document.body.innerHTML;
      },
    });

    await transport.print({ ...job, text: ['<script>alert(1)</script>'] });

    expect(body).toContain('&lt;script&gt;');
    expect(body).not.toContain('<script>');
  });

  it('siempre está disponible', () => {
    expect(createBrowserTransport().isAvailable()).toBe(true);
  });
});

describe('transporte "simulada"', () => {
  it('guarda cada impresión (texto y bytes) para que la lea la E2E', async () => {
    const transport = createSimulatedTransport();

    await transport.print(job);
    await transport.print({ ...job, text: ['otra'] });

    const prints = readSimulatedPrints();
    expect(prints).toHaveLength(2);
    expect(prints[0]).toEqual({ text: job.text, bytes: [0x1b, 0x40, 0x41], columns: 48 });
    expect(prints[1]?.text).toEqual(['otra']);
  });
});
