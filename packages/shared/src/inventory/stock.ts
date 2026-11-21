import type { IngredientUnit } from '../catalog/units';
import { formatMoney } from '../money';

export type StockStatus = 'negativo' | 'bajo_minimo' | 'normal';

/**
 * Determina el estado del stock según la cantidad actual y el mínimo configurado (spec D10).
 * - 'negativo': cantidad < 0.
 * - 'bajo_minimo': mínimo > 0 y cantidad < mínimo.
 * - 'normal': cantidad >= mínimo (o sin mínimo configurado).
 */
export function stockStatus(quantity: number, minQuantity = 0): StockStatus {
  if (quantity < 0) return 'negativo';
  if (minQuantity > 0 && quantity < minQuantity) return 'bajo_minimo';
  return 'normal';
}

const COST_UNIT_LABELS: Record<IngredientUnit, string> = {
  g: 'kg',
  ml: 'L',
  unidad: 'unidad',
};

/**
 * Formatea el costo unitario promedio ponderado a la unidad más legible (spec §3.1 y D2).
 * - g → Bs / kg (factor 1000)
 * - ml → Bs / L (factor 1000)
 * - unidad → Bs / unidad (factor 1)
 *
 * avgUnitCost se recibe en centavos por unidad base como string decimal ("0.800000") o número.
 * Ejemplo: formatUnitCost('0.800000', 'g') === 'Bs 8,00 / kg'
 *          formatUnitCost('150', 'unidad') === 'Bs 1,50 / unidad'
 */
export function formatUnitCost(avgUnitCost: string | number, unit: IngredientUnit): string {
  const str = String(avgUnitCost).trim().replace(',', '.');
  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;
  const [intPart = '0', decPart = ''] = cleanStr.split('.');

  const micro = BigInt(intPart || '0') * 1_000_000n + BigInt(decPart.padEnd(6, '0').slice(0, 6));

  const factor = unit === 'g' || unit === 'ml' ? 1000n : 1n;
  const microTotal = micro * factor;

  // Redondeo al centavo entero más cercano (D2)
  const centsBig = (microTotal + 500_000n) / 1_000_000n;
  const cents = Number(centsBig) * (isNegative ? -1 : 1);

  return `${formatMoney(cents)} / ${COST_UNIT_LABELS[unit]}`;
}

/**
 * Calcula el valor total en centavos del stock existente (spec §3.1).
 * Si el stock es <= 0 o el costo es <= 0, el valor es 0 centavos.
 */
export function computeStockTotalValue(quantity: number, avgUnitCost: string | number): number {
  if (quantity <= 0) return 0;
  const num = typeof avgUnitCost === 'number' ? avgUnitCost : parseFloat(avgUnitCost);
  if (Number.isNaN(num) || num <= 0) return 0;
  return Math.round(quantity * num);
}
