import { describe, expect, it } from 'vitest';
import { promotionStatus } from './status';

describe('promotionStatus', () => {
  const basePromo = {
    isActive: true,
    startsAt: '2026-11-20T10:00:00-04:00',
    endsAt: '2026-11-25T10:00:00-04:00',
  };

  it('devuelve desactivada si isActive es false, sin importar las fechas', () => {
    expect(promotionStatus({ ...basePromo, isActive: false }, '2026-11-22T10:00:00-04:00')).toBe(
      'desactivada',
    );
  });

  it('devuelve programada si el instante es anterior a startsAt', () => {
    expect(promotionStatus(basePromo, '2026-11-20T09:59:59.999-04:00')).toBe('programada');
  });

  it('devuelve vigente si instante == startsAt', () => {
    expect(promotionStatus(basePromo, '2026-11-20T10:00:00-04:00')).toBe('vigente');
  });

  it('devuelve vigente si startsAt <= instante < endsAt', () => {
    expect(promotionStatus(basePromo, '2026-11-22T12:00:00-04:00')).toBe('vigente');
  });

  it('devuelve vigente si endsAt es null y el instante ya inició', () => {
    expect(promotionStatus({ ...basePromo, endsAt: null }, '2030-01-01T00:00:00-04:00')).toBe(
      'vigente',
    );
  });

  it('devuelve vencida si instante == endsAt', () => {
    expect(promotionStatus(basePromo, '2026-11-25T10:00:00-04:00')).toBe('vencida');
  });

  it('devuelve vencida si instante > endsAt', () => {
    expect(promotionStatus(basePromo, '2026-11-25T10:00:01-04:00')).toBe('vencida');
  });

  it('soporta objetos Date además de strings ISO', () => {
    const promoWithDate = {
      isActive: true,
      startsAt: new Date('2026-11-20T10:00:00-04:00'),
      endsAt: new Date('2026-11-25T10:00:00-04:00'),
    };
    expect(promotionStatus(promoWithDate, new Date('2026-11-22T10:00:00-04:00'))).toBe('vigente');
  });
});
