import { createContext, useContext, useMemo, useState } from 'react';
import {
  loadPrinterSettings,
  printTicket,
  savePrinterSettings,
  type PrinterSettings,
} from '@/lib/escpos/printer';
import type { TicketData } from '@/lib/escpos/ticket';
import type { PrinterTransport } from '@/lib/escpos/transports/types';

export const PrintersContext = createContext<PrinterTransport[] | null>(null);

/**
 * Impresora de esta caja: configuración guardada en el dispositivo y el transporte elegido.
 * Si el elegido no está disponible, se usa el navegador (SPEC-offline-print OP-D14).
 */
export function usePrinter() {
  const transports = useContext(PrintersContext);
  if (!transports) throw new Error('usePrinter() debe usarse dentro de <AppProviders>');
  const [settings, setSettings] = useState<PrinterSettings>(loadPrinterSettings);

  return useMemo(() => {
    const browser = transports.find((t) => t.id === 'navegador');
    if (!browser) throw new Error('Falta el transporte "navegador"');
    const chosen = transports.find((t) => t.id === settings.transport && t.isAvailable());
    const transport = chosen ?? browser;
    return {
      settings,
      transports,
      transport,
      save(next: PrinterSettings) {
        savePrinterSettings(next);
        setSettings(next);
      },
      print: (data: TicketData, override: PrinterSettings = settings) => {
        const t = transports.find((x) => x.id === override.transport && x.isAvailable()) ?? browser;
        return printTicket(t, override, data);
      },
      printWithBrowser: (data: TicketData) => printTicket(browser, settings, data),
    };
  }, [transports, settings]);
}
