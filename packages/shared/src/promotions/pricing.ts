import type { PromotionKind } from './promotions.schema';
import { promotionStatus } from './status';

export interface PromotionPricingCandidate {
  id: string;
  name: string;
  kind: PromotionKind;
  value: number;
  startsAt: string | Date;
  endsAt?: string | Date | null;
  isActive: boolean;
  productIds: string[];
}

export interface BestPromotionResult {
  promotionId: string;
  name: string;
  unitDiscountCents: number;
}

/**
 * Calcula el descuento unitario en centavos para un precio dado (spec promotions §2 D1, D2).
 *
 * - porcentaje: round(precio * value / 100)
 * - monto_fijo: min(precio, value)
 * El resultado nunca es negativo y nunca supera el precio unitario.
 */
export function unitDiscount(
  priceCents: number,
  promotion: { kind: PromotionKind; value: number },
): number {
  if (priceCents <= 0 || promotion.value <= 0) {
    return 0;
  }

  let discount: number;
  if (promotion.kind === 'porcentaje') {
    discount = Math.round((priceCents * promotion.value) / 100);
  } else {
    discount = promotion.value;
  }

  return Math.max(0, Math.min(priceCents, discount));
}

/**
 * Elige la mejor promoción vigente para un producto en un instante dado (spec promotions §2 D4, D5).
 *
 * Criterios de selección:
 * 1. Solo promociones activas (isActive = true).
 * 2. Que incluyan productId.
 * 3. En estado 'vigente' en el instante at (startsAt <= at < endsAt).
 *
 * Desempate determinista:
 * 1. Mayor unitDiscountCents (DESC)
 * 2. startsAt más antiguo (ASC)
 * 3. id menor lexicográficamente (ASC)
 */
export function bestPromotion(
  productId: string,
  priceCents: number,
  promotions: PromotionPricingCandidate[],
  at: string | Date = new Date(),
): BestPromotionResult | null {
  if (priceCents <= 0 || !promotions.length) {
    return null;
  }

  let best: (BestPromotionResult & { startsAtMs: number }) | null = null;

  for (const promo of promotions) {
    if (!promo.productIds.includes(productId)) {
      continue;
    }

    if (promotionStatus(promo, at) !== 'vigente') {
      continue;
    }

    const discount = unitDiscount(priceCents, promo);
    if (discount <= 0) {
      continue;
    }

    const startsAtMs =
      promo.startsAt instanceof Date
        ? promo.startsAt.getTime()
        : new Date(promo.startsAt).getTime();

    if (!best) {
      best = {
        promotionId: promo.id,
        name: promo.name,
        unitDiscountCents: discount,
        startsAtMs,
      };
      continue;
    }

    // Desempate 1: Mayor descuento
    if (discount > best.unitDiscountCents) {
      best = {
        promotionId: promo.id,
        name: promo.name,
        unitDiscountCents: discount,
        startsAtMs,
      };
    } else if (discount === best.unitDiscountCents) {
      // Desempate 2: startsAt más antiguo
      if (startsAtMs < best.startsAtMs) {
        best = {
          promotionId: promo.id,
          name: promo.name,
          unitDiscountCents: discount,
          startsAtMs,
        };
      } else if (startsAtMs === best.startsAtMs) {
        // Desempate 3: id menor lexicográficamente
        if (promo.id < best.promotionId) {
          best = {
            promotionId: promo.id,
            name: promo.name,
            unitDiscountCents: discount,
            startsAtMs,
          };
        }
      }
    }
  }

  if (!best) {
    return null;
  }

  return {
    promotionId: best.promotionId,
    name: best.name,
    unitDiscountCents: best.unitDiscountCents,
  };
}
