/**
 * Reglas del catálogo que la BD hace cumplir (spec catalog §3.1). La API las devuelve
 * como 422 BUSINESS_RULE con `details.reason = <código>`.
 */
export const CATALOG_RULES = [
  'PRODUCT_WITHOUT_RECIPE',
  'INGREDIENT_INACTIVE',
  'CATEGORY_INACTIVE',
  'INGREDIENT_IN_USE',
  'CATEGORY_IN_USE',
  'INGREDIENT_UNIT_LOCKED',
  'PRODUCT_NOT_FOUND',
] as const;

export type CatalogRule = (typeof CATALOG_RULES)[number];

export const CATALOG_RULE_MESSAGES: Record<CatalogRule, string> = {
  PRODUCT_WITHOUT_RECIPE: 'Un producto activo necesita al menos un insumo en su receta',
  INGREDIENT_INACTIVE: 'La receta usa un insumo inactivo',
  CATEGORY_INACTIVE: 'La categoría del producto está inactiva',
  INGREDIENT_IN_USE: 'El insumo se usa en productos activos',
  CATEGORY_IN_USE: 'La categoría tiene productos activos',
  INGREDIENT_UNIT_LOCKED: 'No se puede cambiar la unidad de un insumo que ya está en una receta',
  PRODUCT_NOT_FOUND: 'El producto no existe',
};

/** Mensaje en español de una regla del catálogo, o undefined si el código no es del catálogo. */
export function catalogRuleMessage(code: string): string | undefined {
  return (CATALOG_RULE_MESSAGES as Record<string, string>)[code];
}
