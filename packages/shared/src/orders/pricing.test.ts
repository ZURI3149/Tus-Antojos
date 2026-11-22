import { describe, expect, it } from 'vitest';
import type { PromotionPricingCandidate } from '../promotions/pricing';
import type { CatalogProductLookup } from './pricing';
import { priceCart } from './pricing';

describe('priceCart', () => {
  const p1: CatalogProductLookup = {
    id: 'prod-1',
    name: 'Hamburguesa Clásica',
    priceCents: 2500, // Bs 25,00
    isActive: true,
  };

  const p2: CatalogProductLookup = {
    id: 'prod-2',
    name: 'Papas Fritas',
    priceCents: 1000, // Bs 10,00
    isActive: true,
  };

  const promoPercent: PromotionPricingCandidate = {
    id: 'promo-1',
    name: '20% off hamburguesas',
    kind: 'porcentaje',
    value: 20,
    startsAt: '2026-11-01T00:00:00.000Z',
    endsAt: '2026-11-30T23:59:59.000Z',
    isActive: true,
    productIds: ['prod-1'],
  };

  it('calcula totales sin promociones', () => {
    const res = priceCart(
      [
        { productId: 'prod-1', quantity: 2 },
        { productId: 'prod-2', quantity: 1 },
      ],
      [p1, p2],
      [],
    );

    // Subtotal: 2 * 2500 + 1 * 1000 = 6000
    expect(res.subtotalCents).toBe(6000);
    expect(res.discountCents).toBe(0);
    expect(res.totalCents).toBe(6000);
    expect(res.lines).toHaveLength(2);
    expect(res.lines[0]?.lineTotalCents).toBe(5000);
    expect(res.lines[1]?.lineTotalCents).toBe(1000);
  });

  it('aplica descuento de promoción unitario y descuenta proporcionalmente a la cantidad', () => {
    const at = new Date('2026-11-15T12:00:00.000Z');
    const res = priceCart(
      [
        { productId: 'prod-1', quantity: 3, note: 'Término medio' },
        { productId: 'prod-2', quantity: 1 },
      ],
      [p1, p2],
      [promoPercent],
      at,
    );

    // 20% de 2500 es 500 centavos por unidad.
    // 3 * 2500 = 7500. Descuento = 3 * 500 = 1500. Total línea 1 = 6000.
    expect(res.lines[0]?.unitDiscountCents).toBe(500);
    expect(res.lines[0]?.promotionName).toBe('20% off hamburguesas');
    expect(res.lines[0]?.lineTotalCents).toBe(6000);
    expect(res.lines[0]?.note).toBe('Término medio');

    // Línea 2 sin promoción
    expect(res.lines[1]?.unitDiscountCents).toBe(0);
    expect(res.lines[1]?.lineTotalCents).toBe(1000);

    expect(res.subtotalCents).toBe(8500);
    expect(res.discountCents).toBe(1500);
    expect(res.totalCents).toBe(7000);
  });
});
