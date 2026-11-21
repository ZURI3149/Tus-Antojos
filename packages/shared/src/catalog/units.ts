import { z } from 'zod';
import { formatScaledDecimal, parseScaledDecimal } from '../decimal';

/**
 * Unidades de los insumos (spec catalog D2, SPEC.md S3).
 * En la BD siempre se guarda la unidad base con cantidades enteras; la pantalla
 * permite además kg y L, que se convierten (1 kg = 1000 g, 1 L = 1000 ml).
 */

/** Unidades base. Deben coincidir con el tipo `ingredient_unit` de PostgreSQL. */
export const INGREDIENT_UNITS = ['g', 'ml', 'unidad'] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];
export const ingredientUnitSchema = z.enum(INGREDIENT_UNITS, { error: 'Elige una unidad' });

/** Unidades que se pueden escribir en pantalla. */
export const DISPLAY_UNITS = ['g', 'kg', 'ml', 'L', 'unidad'] as const;
export type DisplayUnit = (typeof DISPLAY_UNITS)[number];

/** Decimales permitidos por unidad de pantalla: 10^decimales es su factor a la unidad base. */
const DECIMALS: Record<DisplayUnit, number> = { g: 0, kg: 3, ml: 0, L: 3, unidad: 0 };
const BASE: Record<DisplayUnit, IngredientUnit> = {
  g: 'g',
  kg: 'g',
  ml: 'ml',
  L: 'ml',
  unidad: 'unidad',
};
/** Unidad "grande" de cada base, para mostrar cantidades ≥ 1000. */
const LARGE: Partial<Record<IngredientUnit, DisplayUnit>> = { g: 'kg', ml: 'L' };

export function baseUnitOf(unit: DisplayUnit): IngredientUnit {
  return BASE[unit];
}

/** Unidades de pantalla compatibles con una unidad base: g → [g, kg]. */
export function displayUnitsFor(base: IngredientUnit): DisplayUnit[] {
  return DISPLAY_UNITS.filter((unit) => BASE[unit] === base);
}

/** "1,5" kg → 1500. null si no es una cantidad válida o el resultado no es entero. */
export function parseQuantity(text: string, unit: DisplayUnit): number | null {
  return parseScaledDecimal(text, DECIMALS[unit]);
}

/** 1.5 kg → 1500, sin errores de coma flotante. null si el resultado no es entero. */
export function toBaseQuantity(value: number, unit: DisplayUnit): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  return parseQuantity(String(value), unit);
}

/** Cantidad en la unidad más legible, lista para un campo de edición: 1500 g → "1,5" kg. */
export function toDisplayQuantity(
  base: number,
  unit: IngredientUnit,
): { text: string; unit: DisplayUnit } {
  const large = LARGE[unit];
  if (large && base >= 1000) {
    return { text: formatScaledDecimal(base, DECIMALS[large], { thousands: false }), unit: large };
  }
  return { text: String(base), unit };
}

/** 1500 g → "1,5 kg"; -1500 g → "-1,5 kg"; 3 unidad → "3 unidades". */
export function formatQuantity(base: number, unit: IngredientUnit): string {
  if (unit === 'unidad') {
    return `${formatScaledDecimal(base, 0)} ${Math.abs(base) === 1 ? 'unidad' : 'unidades'}`;
  }
  const large = LARGE[unit];
  if (large && Math.abs(base) >= 1000)
    return `${formatScaledDecimal(base, DECIMALS[large])} ${large}`;
  return `${formatScaledDecimal(base, 0)} ${unit}`;
}
