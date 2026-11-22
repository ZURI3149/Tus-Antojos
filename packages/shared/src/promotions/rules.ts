/**
 * Reglas de promociones que la BD y la API hacen cumplir (spec promotions §3.1).
 * La API las devuelve como 422 BUSINESS_RULE con `details.reason = <código>`.
 */

export const PROMOTION_RULES = [
  'PROMOTION_NOT_FOUND',
  'PRODUCT_NOT_FOUND',
  'PROMOTION_NAME_TAKEN',
] as const;

export type PromotionRule = (typeof PROMOTION_RULES)[number];

export const PROMOTION_RULE_MESSAGES: Record<PromotionRule, string> = {
  PROMOTION_NOT_FOUND: 'La promoción no existe',
  PRODUCT_NOT_FOUND: 'El producto no existe',
  PROMOTION_NAME_TAKEN: 'Ya existe una promoción activa con este nombre',
};

/** Mensaje en español de una regla de promoción, o undefined si el código no pertenece a este módulo. */
export function promotionRuleMessage(code: string): string | undefined {
  return (PROMOTION_RULE_MESSAGES as Record<string, string>)[code];
}
