export const PROMOTION_STATUSES = ['vigente', 'programada', 'vencida', 'desactivada'] as const;

export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export interface PromotionStatusTarget {
  isActive: boolean;
  startsAt: string | Date;
  endsAt?: string | Date | null;
}

/**
 * Determina el estado derivado de una promoción en un instante dado (spec promotions §2 D6).
 *
 * - desactivada: isActive = false (prioridad sobre fechas)
 * - programada: now < startsAt
 * - vencida: endsAt != null y now >= endsAt (endsAt es exclusivo)
 * - vigente: startsAt <= now y (endsAt == null o now < endsAt)
 */
export function promotionStatus(
  promotion: PromotionStatusTarget,
  now: string | Date = new Date(),
): PromotionStatus {
  if (!promotion.isActive) {
    return 'desactivada';
  }

  const tNow = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const tStart =
    promotion.startsAt instanceof Date
      ? promotion.startsAt.getTime()
      : new Date(promotion.startsAt).getTime();
  const tEnd = promotion.endsAt
    ? promotion.endsAt instanceof Date
      ? promotion.endsAt.getTime()
      : new Date(promotion.endsAt).getTime()
    : null;

  if (tNow < tStart) {
    return 'programada';
  }

  if (tEnd !== null && tNow >= tEnd) {
    return 'vencida';
  }

  return 'vigente';
}
