import { z } from 'zod';
import {
  DEFAULT_TICKET_CONFIG,
  encodeTicket,
  layoutTicket,
  opsToText,
  type TicketConfig,
  type TicketData,
} from './ticket';
import type { PrinterTransport } from './transports/types';

const STORAGE_KEY = 'tus-antojos:printer';

const settingsSchema = z.object({
  transport: z.enum(['navegador', 'simulada', 'serial', 'usb']),
  columns: z.union([z.literal(48), z.literal(32)]),
  transliterate: z.boolean(),
  autoPrint: z.boolean(),
  copies: z.number().int().min(1).max(3),
  header: z.object({
    businessName: z.string().trim().min(1).max(40),
    address: z.string().trim().max(60),
    taxId: z.string().trim().max(20),
  }),
  footer: z.string().trim().max(60),
});

/** Configuración de la impresora de esta caja (SPEC-offline-print OP-D13). */
export type PrinterSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  transport: 'navegador',
  columns: 48,
  transliterate: false,
  autoPrint: true,
  copies: 1,
  header: { businessName: DEFAULT_TICKET_CONFIG.header.businessName, address: '', taxId: '' },
  footer: DEFAULT_TICKET_CONFIG.footer,
};

/** Lee la configuración guardada en este navegador; si falta o está rota, la de por defecto. */
export function loadPrinterSettings(): PrinterSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRINTER_SETTINGS;
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_PRINTER_SETTINGS;
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export function savePrinterSettings(settings: PrinterSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsSchema.parse(settings)));
  } catch {
    // Sin almacenamiento (navegación privada, cuota): la configuración dura hasta recargar.
  }
}

export function ticketConfigFrom(settings: PrinterSettings): TicketConfig {
  return {
    columns: settings.columns,
    transliterate: settings.transliterate,
    header: {
      businessName: settings.header.businessName,
      address: settings.header.address || undefined,
      taxId: settings.header.taxId || undefined,
    },
    footer: settings.footer || DEFAULT_TICKET_CONFIG.footer,
  };
}

/** Diseña el ticket y lo manda al transporte, una vez por copia. */
export async function printTicket(
  transport: PrinterTransport,
  settings: PrinterSettings,
  data: TicketData,
): Promise<void> {
  const config = ticketConfigFrom(settings);
  const ops = layoutTicket(data, config);
  const job = {
    bytes: encodeTicket(ops, config),
    text: opsToText(ops, config.columns),
    columns: config.columns,
  };
  for (let i = 0; i < settings.copies; i++) await transport.print(job);
}

/** Ticket del botón "Ticket de prueba": prueba tildes, ñ, signos y el corte. */
export const testTicket = (now = new Date()): TicketData => ({
  orderLabel: 'TEST',
  createdAt: now.toISOString(),
  cashierName: null,
  lines: [
    {
      name: 'TICKET DE PRUEBA · áéíóú ñ ¿? ¡!',
      quantity: 1,
      unitPriceCents: 0,
      promotionName: null,
      unitDiscountCents: 0,
      lineTotalCents: 0,
      note: 'Si ves bien las tildes y la ñ, la impresora está lista.',
    },
  ],
  subtotalCents: 0,
  discountCents: 0,
  totalCents: 0,
  paymentMethod: 'efectivo',
  cashReceivedCents: null,
  changeCents: null,
  offline: false,
  reprint: false,
});
