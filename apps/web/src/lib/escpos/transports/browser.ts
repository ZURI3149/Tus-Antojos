import type { PrinterTransport, PrintJob } from './types';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plantilla de impresión: ancho del papel y una letra monoespaciada que hace entrar las columnas. */
export function ticketHtml(job: Pick<PrintJob, 'text' | 'columns'>): string {
  const paper = job.columns === 32 ? '58mm' : '80mm';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>
@page { size: ${paper} auto; margin: 0; }
html, body { margin: 0; background: #fff; color: #000; }
body { padding: 2mm 3mm; }
pre { margin: 0; white-space: pre; font: 2.5mm/1.25 'Courier New', Courier, monospace; }
</style></head><body><pre>${escapeHtml(job.text.join('\n'))}</pre></body></html>`;
}

/**
 * Imprime con el diálogo del navegador (`window.print()`), sin depender del hardware: es el
 * respaldo cuando no hay Web Serial/WebUSB o la impresora falla (SPEC-offline-print OP-D14).
 */
export function createBrowserTransport({
  print = (win: Window) => {
    win.focus();
    win.print();
  },
}: { print?: (win: Window) => void } = {}): PrinterTransport {
  return {
    id: 'navegador',
    label: 'Imprimir con el navegador',
    isAvailable: () => true,
    async print(job) {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0;';
      document.body.appendChild(iframe);
      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc || !win) throw new Error('No se pudo preparar la impresión');
        doc.open();
        doc.write(ticketHtml(job));
        doc.close();
        print(win);
      } finally {
        iframe.remove();
      }
    },
  };
}
