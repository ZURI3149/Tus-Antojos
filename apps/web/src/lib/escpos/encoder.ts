import { CP858, toAscii } from './cp858';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
/** Número de la página CP858 en impresoras compatibles con Epson (ESC t 19). */
const CODEPAGE_CP858 = 19;

export type PaperColumns = 48 | 32;
export type Align = 'left' | 'center' | 'right';

export interface EncoderOptions {
  /** 48 columnas para papel de 80 mm, 32 para 58 mm (fuente A). */
  columns?: PaperColumns;
  /** Escribir solo ASCII (impresoras sin CP858): "Café" → "Cafe", "€" → "EUR". */
  transliterate?: boolean;
}

export interface Encoder {
  readonly columns: PaperColumns;
  init(): Encoder;
  align(align: Align): Encoder;
  bold(on: boolean): Encoder;
  /** Multiplicador de ancho y alto (1 o 2); sin argumentos vuelve al tamaño normal. */
  size(size?: { width?: 1 | 2; height?: 1 | 2 }): Encoder;
  /** Texto y salto de línea. */
  text(text: string): Encoder;
  /** Texto a la izquierda y a la derecha en una sola línea del ancho del papel. */
  line(left: string, right: string): Encoder;
  /** Línea separadora del ancho del papel. */
  rule(char?: string): Encoder;
  feed(lines: number): Encoder;
  /** Corte parcial del papel. */
  cut(): Encoder;
  encode(): Uint8Array;
}

/**
 * Construye los bytes ESC/POS de un ticket (SPEC-offline-print OP-D12). Es puro: no sabe
 * nada de la impresora; el transporte solo envía lo que devuelve `encode()`.
 */
export function createEncoder({
  columns = 48,
  transliterate = false,
}: EncoderOptions = {}): Encoder {
  const out: number[] = [];

  /** Bytes de un texto: un byte por columna. Los saltos y tabulaciones pasan a espacio. */
  function encodeText(text: string): number[] {
    const bytes: number[] = [];
    for (const char of text.normalize('NFC').replace(/[\r\n\t]/g, ' ')) {
      const code = char.codePointAt(0)!;
      if (code < 0x80) {
        bytes.push(code);
        continue;
      }
      const mapped = transliterate ? undefined : CP858[char];
      if (mapped !== undefined) {
        bytes.push(mapped);
        continue;
      }
      for (const c of toAscii(char)) bytes.push(c.charCodeAt(0));
    }
    return bytes;
  }

  const enc: Encoder = {
    columns,
    init() {
      out.push(ESC, 0x40);
      if (!transliterate) out.push(ESC, 0x74, CODEPAGE_CP858);
      return enc;
    },
    align(align) {
      out.push(ESC, 0x61, align === 'left' ? 0 : align === 'center' ? 1 : 2);
      return enc;
    },
    bold(on) {
      out.push(ESC, 0x45, on ? 1 : 0);
      return enc;
    },
    size({ width = 1, height = 1 } = {}) {
      out.push(GS, 0x21, ((width - 1) << 4) | (height - 1));
      return enc;
    },
    text(text) {
      out.push(...encodeText(text), LF);
      return enc;
    },
    line(left, right) {
      const r = encodeText(right).slice(0, columns);
      const room = Math.max(0, columns - r.length - 1);
      const l = encodeText(left).slice(0, room);
      const gap = columns - l.length - r.length;
      out.push(...l, ...new Array<number>(gap).fill(0x20), ...r, LF);
      return enc;
    },
    rule(char = '-') {
      out.push(...encodeText(char.repeat(columns)).slice(0, columns), LF);
      return enc;
    },
    feed(lines) {
      out.push(ESC, 0x64, Math.max(0, Math.min(255, Math.trunc(lines))));
      return enc;
    },
    cut() {
      out.push(GS, 0x56, 1);
      return enc;
    },
    encode() {
      return Uint8Array.from(out);
    },
  };
  return enc;
}
