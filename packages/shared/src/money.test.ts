import { describe, expect, it } from 'vitest';
import { formatMoney, moneyInputSchema, parseMoney } from './money';

describe('parseMoney', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.50', 1250],
    [' 0,99 ', 99],
    ['0', 0],
    ['1000000', 100_000_000],
  ])('%j → %i centavos', (text, cents) => {
    expect(parseMoney(text)).toBe(cents);
  });

  it.each(['', ' ', 'abc', '-5', '12,505', '1.234,50', '12,', ',5', '1e3', '12 50'])(
    'rechaza %j',
    (text) => {
      expect(parseMoney(text)).toBeNull();
    },
  );

  it('no pierde centavos por coma flotante', () => {
    // 0.29 * 100 = 28.999999999999996 en coma flotante.
    expect(parseMoney('0,29')).toBe(29);
    expect(parseMoney('1,005')).toBeNull();
  });
});

describe('formatMoney', () => {
  it.each([
    [0, 'Bs 0,00'],
    [5, 'Bs 0,05'],
    [1250, 'Bs 12,50'],
    [123_456, 'Bs 1.234,56'],
    [100_000_000, 'Bs 1.000.000,00'],
    [-1250, '-Bs 12,50'],
  ])('%i → %j', (cents, text) => {
    expect(formatMoney(cents)).toBe(text);
  });

  it('rechaza montos no enteros', () => {
    expect(() => formatMoney(12.5)).toThrow();
  });
});

describe('moneyInputSchema', () => {
  it('convierte el texto del formulario a centavos', () => {
    expect(moneyInputSchema.parse('12,50')).toBe(1250);
  });

  it('da un mensaje en español si el texto no es un monto', () => {
    const result = moneyInputSchema.safeParse('doce');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Ingresa un monto válido, p. ej. 12,50');
  });
});
