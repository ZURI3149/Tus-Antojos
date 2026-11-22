import { describe, expect, it } from 'vitest';
import { PROMOTION_RULE_MESSAGES, PROMOTION_RULES, promotionRuleMessage } from './rules';

describe('promotions rules', () => {
  it('tiene un mensaje para cada código de regla', () => {
    for (const rule of PROMOTION_RULES) {
      expect(PROMOTION_RULE_MESSAGES[rule]).toBeDefined();
      expect(PROMOTION_RULE_MESSAGES[rule].length).toBeGreaterThan(0);
    }
  });

  it('devuelve el mensaje correspondiente para reglas conocidas', () => {
    expect(promotionRuleMessage('PROMOTION_NOT_FOUND')).toBe('La promoción no existe');
    expect(promotionRuleMessage('PRODUCT_NOT_FOUND')).toBe('El producto no existe');
    expect(promotionRuleMessage('PROMOTION_NAME_TAKEN')).toBe(
      'Ya existe una promoción activa con este nombre',
    );
  });

  it('devuelve undefined para códigos desconocidos', () => {
    expect(promotionRuleMessage('UNKNOWN_RULE')).toBeUndefined();
  });
});
