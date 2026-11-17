/**
 * Convierte un decimal escrito por una persona ("12,5", "1.5") en un entero escalado
 * (`"12,5"` con 2 decimales → 1250) sin pasar por coma flotante.
 * Acepta coma o punto como separador decimal y NO acepta separadores de miles.
 * Devuelve null si el texto no es un número no negativo o tiene más de `decimals` decimales.
 */
export function parseScaledDecimal(text: string, decimals: number): number | null {
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(text.trim());
  if (!match) return null;
  const [, intPart = '', fracPart = ''] = match;
  if (fracPart.length > decimals) return null;
  const value = Number(intPart + fracPart.padEnd(decimals, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

/** Agrupa miles con punto: 1234567 → "1.234.567". */
export function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formatea un entero escalado con coma decimal: (1500, 3) → "1,5".
 * `minDecimals` fija los decimales mínimos (dinero: 2) y quita ceros sobrantes.
 */
export function formatScaledDecimal(
  value: number,
  decimals: number,
  { minDecimals = 0, thousands = true }: { minDecimals?: number; thousands?: boolean } = {},
): string {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Se esperaba un entero: ${value}`);
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.abs(value)).padStart(decimals + 1, '0');
  const intPart = digits.slice(0, digits.length - decimals);
  let fracPart = digits.slice(digits.length - decimals);
  while (fracPart.length > minDecimals && fracPart.endsWith('0')) fracPart = fracPart.slice(0, -1);
  const int = thousands ? groupThousands(intPart) : intPart;
  return sign + (fracPart ? `${int},${fracPart}` : int);
}
