/**
 * Reglas de inventario que la BD hace cumplir (spec inventory §2 y §3.1).
 * La API las devuelve como 422 BUSINESS_RULE con `details.reason = <código>`.
 */

export const INVENTORY_RULES = [
  'STOCK_INSUFFICIENT',
  'ADJUSTMENT_NO_CHANGE',
  'INGREDIENT_NOT_FOUND',
  'KARDEX_APPEND_ONLY',
  'INGREDIENT_INACTIVE',
  'INGREDIENT_UNIT_LOCKED',
  'PURCHASE_EMPTY',
  'PURCHASE_TOTAL_TOO_HIGH',
  'QUANTITY_MUST_BE_POSITIVE',
  'COUNT_MUST_BE_NON_NEGATIVE',
  'COMPRA_REQUIRES_COST',
] as const;

export type InventoryRule = (typeof INVENTORY_RULES)[number];

export const INVENTORY_RULE_MESSAGES: Record<InventoryRule, string> = {
  STOCK_INSUFFICIENT: 'No hay suficiente stock disponible para registrar la salida',
  ADJUSTMENT_NO_CHANGE: 'La cantidad contada es igual al stock actual',
  INGREDIENT_NOT_FOUND: 'El insumo no existe',
  KARDEX_APPEND_ONLY: 'Los movimientos del kardex no se pueden modificar ni eliminar',
  INGREDIENT_INACTIVE: 'El insumo está inactivo',
  INGREDIENT_UNIT_LOCKED:
    'No se puede cambiar la unidad de un insumo que ya tiene movimientos en el kardex',
  PURCHASE_EMPTY: 'La compra debe tener al menos un insumo',
  PURCHASE_TOTAL_TOO_HIGH: 'El total de la compra es demasiado alto',
  QUANTITY_MUST_BE_POSITIVE: 'La cantidad debe ser mayor a 0',
  COUNT_MUST_BE_NON_NEGATIVE: 'La cantidad contada no puede ser negativa',
  COMPRA_REQUIRES_COST: 'La compra debe indicar el costo de cada insumo',
};

/** Mensaje en español de una regla de inventario, o undefined si el código no pertenece a este módulo. */
export function inventoryRuleMessage(code: string): string | undefined {
  return (INVENTORY_RULE_MESSAGES as Record<string, string>)[code];
}
