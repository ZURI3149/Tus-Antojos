import { z } from 'zod';
import { formatScaledDecimal, parseScaledDecimal } from './decimal';

/**
 * Dinero: siempre en centavos enteros (SPEC.md S2). Moneda única: bolivianos (Bs).
 */

/** "12,50" | "12.5" | "12" → centavos. null si no es un monto válido (máx. 2 decimales). */
export function parseMoney(text: string): number | null {
  return parseScaledDecimal(text, 2);
}

/** 123456 → "Bs 1.234,56". */
export function formatMoney(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`Monto no entero: ${cents}`);
  const amount = formatScaledDecimal(Math.abs(cents), 2, { minDecimals: 2 });
  return `${cents < 0 ? '-' : ''}Bs ${amount}`;
}

/** Campo de formulario con un monto en Bs; su salida son centavos. */
export const moneyInputSchema = z.string().transform((text, ctx) => {
  const cents = parseMoney(text);
  if (cents === null) {
    ctx.addIssue({ code: 'custom', message: 'Ingresa un monto válido, p. ej. 12,50' });
    return z.NEVER;
  }
  return cents;
});
