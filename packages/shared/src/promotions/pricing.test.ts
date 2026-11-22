import { describe, expect, it } from 'vitest';
import pricingCases from './pricing-cases.json';
import { bestPromotion, unitDiscount, type PromotionPricingCandidate } from './pricing';

describe('unitDiscount', () => {
  it('calcula porcentaje entero exacto: 20 % de 2500 -> 500', () => {
    expect(unitDiscount(2500, { kind: 'porcentaje', value: 20 })).toBe(500);
  });

  it('redondea porcentaje: 33 % de 10 -> 3 (3.3 hacia abajo)', () => {
    expect(unitDiscount(10, { kind: 'porcentaje', value: 33 })).toBe(3);
  });

  it('redondea mitad hacia arriba: 35 % de 10 -> 4 (3.5 hacia arriba)', () => {
    expect(unitDiscount(10, { kind: 'porcentaje', value: 35 })).toBe(4);
  });

  it('recorta monto fijo mayor al precio: Bs 30 de descuento sobre Bs 25 -> 2500', () => {
    expect(unitDiscount(2500, { kind: 'monto_fijo', value: 3000 })).toBe(2500);
  });

  it('aplica monto fijo menor al precio: Bs 5 de descuento sobre Bs 25 -> 500', () => {
    expect(unitDiscount(2500, { kind: 'monto_fijo', value: 500 })).toBe(500);
  });

  it('100 % de descuento devuelve el precio completo', () => {
    expect(unitDiscount(2500, { kind: 'porcentaje', value: 100 })).toBe(2500);
  });

  it('no devuelve números negativos ante precio o valor 0', () => {
    expect(unitDiscount(0, { kind: 'porcentaje', value: 20 })).toBe(0);
    expect(unitDiscount(2500, { kind: 'monto_fijo', value: 0 })).toBe(0);
  });
});

describe('bestPromotion', () => {
  it('recorre y cumple todos los casos de pricing-cases.json', () => {
    expect(pricingCases.length).toBeGreaterThanOrEqual(12);

    for (const testCase of pricingCases) {
      const result = bestPromotion(
        testCase.productId,
        testCase.priceCents,
        testCase.promotions as unknown as PromotionPricingCandidate[],
        testCase.at,
      );

      expect(result, `Fallo en caso ${testCase.id}: ${testCase.description}`).toEqual(
        testCase.expected,
      );
    }
  });

  it('devuelve null si la lista de promociones está vacía', () => {
    expect(bestPromotion('prod-1', 2500, [])).toBeNull();
  });
});
