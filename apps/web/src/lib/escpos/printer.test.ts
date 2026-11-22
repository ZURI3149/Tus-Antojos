import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PRINTER_SETTINGS,
  loadPrinterSettings,
  printTicket,
  savePrinterSettings,
  testTicket,
  type PrinterSettings,
} from './printer';
import type { PrintJob, PrinterTransport } from './transports/types';

afterEach(() => {
  localStorage.clear();
});

function recordingTransport(): PrinterTransport & { jobs: PrintJob[] } {
  const jobs: PrintJob[] = [];
  return {
    id: 'simulada',
    label: 'Impresora simulada',
    jobs,
    isAvailable: () => true,
    print: async (job) => {
      jobs.push(job);
    },
  };
}

describe('configuración de la impresora (por dispositivo)', () => {
  it('sin nada guardado usa los valores por defecto: navegador, 80 mm, impresión automática', () => {
    expect(loadPrinterSettings()).toEqual(DEFAULT_PRINTER_SETTINGS);
    expect(DEFAULT_PRINTER_SETTINGS).toMatchObject({
      transport: 'navegador',
      columns: 48,
      transliterate: false,
      autoPrint: true,
      copies: 1,
    });
  });

  it('guarda y recupera la configuración', () => {
    const settings: PrinterSettings = {
      ...DEFAULT_PRINTER_SETTINGS,
      transport: 'simulada',
      columns: 32,
      autoPrint: false,
      copies: 2,
      header: { businessName: 'TUS ANTOJOS', address: 'Av. Siempre Viva 123', taxId: '' },
    };

    savePrinterSettings(settings);

    expect(loadPrinterSettings()).toEqual(settings);
  });

  it('si lo guardado está roto o tiene otra forma, vuelve a los valores por defecto', () => {
    localStorage.setItem('tus-antojos:printer', '{roto');
    expect(loadPrinterSettings()).toEqual(DEFAULT_PRINTER_SETTINGS);

    localStorage.setItem('tus-antojos:printer', JSON.stringify({ columns: 99, copies: 'x' }));
    expect(loadPrinterSettings()).toEqual(DEFAULT_PRINTER_SETTINGS);
  });
});

describe('printTicket', () => {
  it('envía al transporte los bytes y el texto del mismo diseño, una vez por copia', async () => {
    const transport = recordingTransport();
    const settings = { ...DEFAULT_PRINTER_SETTINGS, copies: 2 };

    await printTicket(transport, settings, testTicket());

    expect(transport.jobs).toHaveLength(2);
    const [job] = transport.jobs;
    expect(job?.columns).toBe(48);
    expect(job?.text.some((l) => l.includes('TICKET DE PRUEBA'))).toBe(true);
    expect([...job!.bytes].slice(0, 2)).toEqual([0x1b, 0x40]);
  });

  it('usa el encabezado configurado y el ancho de papel elegido', async () => {
    const transport = recordingTransport();
    const settings: PrinterSettings = {
      ...DEFAULT_PRINTER_SETTINGS,
      columns: 32,
      header: { businessName: 'HELADERÍA X', address: '', taxId: '987' },
    };

    await printTicket(transport, settings, testTicket());

    const text = transport.jobs[0]!.text;
    expect(text.every((l) => l.length <= 32)).toBe(true);
    expect(text.some((l) => l.includes('HELADERÍA X'))).toBe(true);
    expect(text.some((l) => l.includes('NIT 987'))).toBe(true);
  });
});
