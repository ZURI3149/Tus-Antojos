import { describe, expect, it } from 'vitest';
import {
  baseUnitOf,
  displayUnitsFor,
  formatQuantity,
  parseQuantity,
  toBaseQuantity,
  toDisplayQuantity,
} from './units';

describe('parseQuantity', () => {
  it.each([
    ['1,5', 'kg', 1500],
    ['1.5', 'kg', 1500],
    ['2', 'L', 2000],
    ['0,125', 'kg', 125],
    ['0,001', 'L', 1],
    ['250', 'g', 250],
    ['3', 'unidad', 3],
    [' 10 ', 'ml', 10],
  ] as const)('%j %s → %i', (text, unit, base) => {
    expect(parseQuantity(text, unit)).toBe(base);
  });

  it.each([
    ['1,2345', 'kg'], // 1234,5 g: no es entero
    ['2,5', 'g'], // las unidades base no admiten decimales
    ['1,5', 'unidad'],
    ['-1', 'g'],
    ['', 'g'],
    ['abc', 'kg'],
    ['1.000,5', 'kg'],
  ] as const)('rechaza %j %s', (text, unit) => {
    expect(parseQuantity(text, unit)).toBeNull();
  });
});

describe('toBaseQuantity', () => {
  it('convierte números sin errores de coma flotante', () => {
    expect(toBaseQuantity(1.5, 'kg')).toBe(1500);
    expect(toBaseQuantity(2, 'L')).toBe(2000);
    expect(toBaseQuantity(1.005, 'kg')).toBe(1005);
    expect(toBaseQuantity(1.2345, 'kg')).toBeNull();
    expect(toBaseQuantity(Number.NaN, 'g')).toBeNull();
  });
});

describe('formatQuantity', () => {
  it.each([
    [250, 'g', '250 g'],
    [1000, 'g', '1 kg'],
    [1500, 'g', '1,5 kg'],
    [1_234_567, 'g', '1.234,567 kg'],
    [999, 'ml', '999 ml'],
    [2250, 'ml', '2,25 L'],
    [1, 'unidad', '1 unidad'],
    [3, 'unidad', '3 unidades'],
    [0, 'g', '0 g'],
    [-1500, 'g', '-1,5 kg'],
    [-250, 'g', '-250 g'],
    [-1, 'unidad', '-1 unidad'],
    [-2, 'unidad', '-2 unidades'],
  ] as const)('%i %s → %j', (base, unit, text) => {
    expect(formatQuantity(base, unit)).toBe(text);
  });
});

describe('toDisplayQuantity', () => {
  it('elige la unidad más legible para editar', () => {
    expect(toDisplayQuantity(1500, 'g')).toEqual({ text: '1,5', unit: 'kg' });
    expect(toDisplayQuantity(250, 'g')).toEqual({ text: '250', unit: 'g' });
    expect(toDisplayQuantity(2000, 'ml')).toEqual({ text: '2', unit: 'L' });
    expect(toDisplayQuantity(4, 'unidad')).toEqual({ text: '4', unit: 'unidad' });
  });

  it('vuelve al mismo valor al parsearse', () => {
    for (const base of [1, 999, 1000, 1001, 1500, 123_456]) {
      const { text, unit } = toDisplayQuantity(base, 'g');
      expect(parseQuantity(text, unit)).toBe(base);
    }
  });
});

describe('unidades', () => {
  it('relaciona cada unidad de pantalla con su unidad base', () => {
    expect(baseUnitOf('kg')).toBe('g');
    expect(baseUnitOf('L')).toBe('ml');
    expect(baseUnitOf('unidad')).toBe('unidad');
    expect(displayUnitsFor('g')).toEqual(['g', 'kg']);
    expect(displayUnitsFor('unidad')).toEqual(['unidad']);
  });
});
