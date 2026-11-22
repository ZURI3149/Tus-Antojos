import '@testing-library/jest-dom/vitest';
// IndexedDB en memoria para la cola offline (jsdom no la implementa).
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom no implementa matchMedia; lo usan Sonner y next-themes para el tema.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom no implementa la captura de puntero; Sonner la usa al tocar un toast (p. ej. sus botones).
Element.prototype.setPointerCapture ??= vi.fn();
Element.prototype.releasePointerCapture ??= vi.fn();
Element.prototype.hasPointerCapture ??= vi.fn(() => false);

// jsdom no implementa HTMLDialogElement.showModal ni close
HTMLDialogElement.prototype.showModal ??= function () {
  this.open = true;
};
HTMLDialogElement.prototype.show ??= function () {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function () {
  this.open = false;
  this.dispatchEvent(new Event('close'));
};

afterEach(() => {
  cleanup();
  // Tickets de la impresora simulada (lib/escpos/transports/simulated.ts).
  delete window.__tusAntojosPrints;
});
