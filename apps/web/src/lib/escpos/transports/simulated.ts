import type { PrinterTransport } from './types';

export interface SimulatedPrint {
  text: string[];
  bytes: number[];
  columns: number;
}

declare global {
  interface Window {
    /** Tickets "impresos" por la impresora simulada (la leen las E2E, CE-01). */
    __tusAntojosPrints?: SimulatedPrint[];
  }
}

/** Impresora simulada: guarda en memoria lo que se imprime. Solo con VITE_PRINTER_SIMULATED. */
export function createSimulatedTransport(): PrinterTransport {
  return {
    id: 'simulada',
    label: 'Impresora simulada (pruebas)',
    isAvailable: () => true,
    async print(job) {
      window.__tusAntojosPrints ??= [];
      window.__tusAntojosPrints.push({
        text: [...job.text],
        bytes: Array.from(job.bytes),
        columns: job.columns,
      });
    },
  };
}

export function readSimulatedPrints(): SimulatedPrint[] {
  return window.__tusAntojosPrints ?? [];
}
