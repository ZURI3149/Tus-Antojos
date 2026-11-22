import type { PromotionPricingCandidate } from '../promotions/pricing';
import { bestPromotion } from '../promotions/pricing';

export interface CartLine {
  productId: string;
  quantity: number;
  note?: string;
}

export interface CatalogProductLookup {
  id: string;
  name: string;
  priceCents: number;
  isActive: boolean;
}

export interface PricedCartLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  promotionId: string | null;
  promotionName: string | null;
  unitDiscountCents: number;
  lineTotalCents: number;
  note: string;
}

export interface PricedCart {
  lines: PricedCartLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

/**
 * Calcula el carrito valorizado con sus promociones vigentes por unidad (SPEC-orders.md §2 D1, D5).
 * Usa el mismo algoritmo de desempate y selección que la base de datos (bestPromotion).
 */
export function priceCart(
  lines: CartLine[],
  products: Map<string, CatalogProductLookup> | CatalogProductLookup[],
  promotions: PromotionPricingCandidate[],
  at: Date = new Date(),
): PricedCart {
  const prodMap =
    products instanceof Map
      ? products
      : new Map(products.map((p) => [p.id, p]));

  let subtotalCents = 0;
  let discountCents = 0;

  const pricedLines: PricedCartLine[] = lines.map((line) => {
    const product = prodMap.get(line.productId);
    const unitPriceCents = product?.priceCents ?? 0;
    const productName = product?.name ?? '';

    const promo = bestPromotion(line.productId, unitPriceCents, promotions, at);
    const unitDiscountCents = promo ? promo.unitDiscountCents : 0;
    const promotionId = promo ? promo.promotionId : null;
    const promotionName = promo ? promo.name : null;

    const lineSubtotal = unitPriceCents * line.quantity;
    const lineDiscount = unitDiscountCents * line.quantity;
    const lineTotalCents = lineSubtotal - lineDiscount;

    subtotalCents += lineSubtotal;
    discountCents += lineDiscount;

    return {
      productId: line.productId,
      productName,
      quantity: line.quantity,
      unitPriceCents,
      promotionId,
      promotionName,
      unitDiscountCents,
      lineTotalCents,
      note: line.note ?? '',
    };
  });

  const totalCents = Math.max(0, subtotalCents - discountCents);

  return {
    lines: pricedLines,
    subtotalCents,
    discountCents,
    totalCents,
  };
}
