import { describe, expect, it } from 'vitest';
import { createEncoder } from './encoder';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const bytes = (enc: { encode(): Uint8Array }) => [...enc.encode()];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe('createEncoder: comandos', () => {
  it('init reinicia la impresora (ESC @) y elige la página de códigos CP858 (ESC t 19)', () => {
    expect(bytes(createEncoder().init())).toEqual([ESC, 0x40, ESC, 0x74, 19]);
  });

  it('con transliteración, init no cambia la página de códigos', () => {
    expect(bytes(createEncoder({ transliterate: true }).init())).toEqual([ESC, 0x40]);
  });

  it('align: izquierda, centro y derecha (ESC a n)', () => {
    const enc = createEncoder().align('left').align('center').align('right');
    expect(bytes(enc)).toEqual([ESC, 0x61, 0, ESC, 0x61, 1, ESC, 0x61, 2]);
  });

  it('bold: activa y desactiva la negrita (ESC E n)', () => {
    expect(bytes(createEncoder().bold(true).bold(false))).toEqual([ESC, 0x45, 1, ESC, 0x45, 0]);
  });

  it('size: doble alto y ancho, y vuelta al normal (GS ! n)', () => {
    const enc = createEncoder().size({ width: 2, height: 2 }).size({ width: 1, height: 2 }).size();
    expect(bytes(enc)).toEqual([GS, 0x21, 0x11, GS, 0x21, 0x01, GS, 0x21, 0x00]);
  });

  it('feed avanza n líneas (ESC d n) y cut corta el papel de forma parcial (GS V 1)', () => {
    expect(bytes(createEncoder().feed(3).cut())).toEqual([ESC, 0x64, 3, GS, 0x56, 1]);
  });

  it('text escribe el texto y un salto de línea', () => {
    expect(bytes(createEncoder().text('Hola'))).toEqual([...ascii('Hola'), LF]);
  });

  it('los comandos se encadenan en orden', () => {
    const enc = createEncoder().init().align('center').bold(true).text('TUS ANTOJOS').bold(false);
    expect(bytes(enc)).toEqual([
      ESC,
      0x40,
      ESC,
      0x74,
      19,
      ESC,
      0x61,
      1,
      ESC,
      0x45,
      1,
      ...ascii('TUS ANTOJOS'),
      LF,
      ESC,
      0x45,
      0,
    ]);
  });
});

describe('createEncoder: caracteres en español', () => {
  it('codifica tildes, ñ, signos de apertura y € en CP858', () => {
    expect(bytes(createEncoder().text('áéíóúñÑ¿¡€'))).toEqual([
      0xa0,
      0x82,
      0xa1,
      0xa2,
      0xa3,
      0xa4,
      0xa5,
      0xa8,
      0xad,
      0xd5,
      LF,
    ]);
  });

  it('codifica mayúsculas con tilde y diéresis', () => {
    expect(bytes(createEncoder().text('ÁÉÍÓÚüÜ'))).toEqual([
      0xb5,
      0x90,
      0xd6,
      0xe0,
      0xe9,
      0x81,
      0x9a,
      LF,
    ]);
  });

  it('con transliteración escribe solo ASCII', () => {
    expect(bytes(createEncoder({ transliterate: true }).text('áéíóú ñÑ ¿¡ €'))).toEqual([
      ...ascii('aeiou nN ?! EUR'),
      LF,
    ]);
  });

  it('un carácter sin equivalente se reemplaza por ?', () => {
    expect(bytes(createEncoder().text('🍦 x'))).toEqual([...ascii('? x'), LF]);
  });

  it('normaliza letras con tilde compuesta (NFD) antes de codificar', () => {
    expect(bytes(createEncoder().text('á'))).toEqual([0xa0, LF]);
  });
});

describe('createEncoder.line: dos columnas', () => {
  it('rellena con espacios hasta 48 columnas (80 mm)', () => {
    const out = bytes(createEncoder().line('Cono de frutilla x2', 'Bs 20,00'));
    expect(out).toHaveLength(48 + 1);
    expect(String.fromCharCode(...out.slice(0, 48))).toBe(
      'Cono de frutilla x2' + ' '.repeat(48 - 19 - 8) + 'Bs 20,00',
    );
    expect(out.at(-1)).toBe(LF);
  });

  it('en 58 mm usa 32 columnas', () => {
    const out = bytes(createEncoder({ columns: 32 }).line('Total', 'Bs 8,00'));
    expect(String.fromCharCode(...out.slice(0, 32))).toBe('Total' + ' '.repeat(20) + 'Bs 8,00');
  });

  it('corta el texto de la izquierda si no entra, dejando al menos un espacio', () => {
    const out = bytes(createEncoder({ columns: 32 }).line('x'.repeat(40), 'Bs 100,00'));
    const textLine = String.fromCharCode(...out.slice(0, -1));
    expect(textLine).toHaveLength(32);
    expect(textLine).toBe('x'.repeat(32 - 9 - 1) + ' Bs 100,00');
  });

  it('cuenta las tildes como una columna', () => {
    const out = bytes(createEncoder({ columns: 32 }).line('Café', 'Bs 5,00'));
    expect(out.slice(0, -1)).toHaveLength(32);
  });

  it('con transliteración cuenta "EUR" como tres columnas', () => {
    const out = bytes(createEncoder({ columns: 32, transliterate: true }).line('Total', '€5'));
    expect(String.fromCharCode(...out.slice(0, -1))).toBe('Total' + ' '.repeat(23) + 'EUR5');
  });
});

describe('createEncoder.rule', () => {
  it('dibuja una línea separadora del ancho del papel', () => {
    const out = bytes(createEncoder({ columns: 32 }).rule());
    expect(String.fromCharCode(...out.slice(0, -1))).toBe('-'.repeat(32));
  });
});
