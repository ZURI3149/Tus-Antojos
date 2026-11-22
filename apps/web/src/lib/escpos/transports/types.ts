import type { PaperColumns } from '../encoder';

export type TransportId = 'navegador' | 'simulada' | 'serial' | 'usb';

/** Un ticket listo para imprimir: los bytes ESC/POS y el mismo contenido como texto. */
export interface PrintJob {
  bytes: Uint8Array;
  text: string[];
  columns: PaperColumns;
}

/** Cómo llega el ticket a la impresora (SPEC-offline-print OP-D13). */
export interface PrinterTransport {
  id: TransportId;
  label: string;
  /** `false` si el navegador no lo soporta; la opción se muestra deshabilitada. */
  isAvailable(): boolean;
  print(job: PrintJob): Promise<void>;
}
