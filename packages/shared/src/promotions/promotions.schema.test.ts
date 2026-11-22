import { describe, expect, it } from 'vitest';
import { createPromotionSchema, promotionSchema, updatePromotionSchema } from './promotions.schema';

describe('promotions schemas', () => {
  const validPromotion = {
    name: '20 % en tortas',
    kind: 'porcentaje' as const,
    value: 20,
    startsAt: '2026-11-20T00:00:00-04:00',
    endsAt: '2026-11-25T00:00:00-04:00',
    productIds: ['00000000-0000-0000-0000-000000000001'],
  };

  describe('createPromotionSchema', () => {
    it('acepta una promoción válida de porcentaje', () => {
      const parsed = createPromotionSchema.safeParse(validPromotion);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe('20 % en tortas');
        expect(parsed.data.value).toBe(20);
      }
    });

    it('acepta una promoción válida de monto fijo', () => {
      const parsed = createPromotionSchema.safeParse({
        ...validPromotion,
        kind: 'monto_fijo',
        value: 500,
      });
      expect(parsed.success).toBe(true);
    });

    it('acepta endsAt = null', () => {
      const parsed = createPromotionSchema.safeParse({
        ...validPromotion,
        endsAt: null,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.endsAt).toBeNull();
      }
    });

    it('rechaza nombre vacío o mayor a 80 caracteres', () => {
      expect(createPromotionSchema.safeParse({ ...validPromotion, name: '' }).success).toBe(false);
      expect(
        createPromotionSchema.safeParse({ ...validPromotion, name: 'a'.repeat(81) }).success,
      ).toBe(false);
    });

    it('rechaza porcentaje mayor a 100 o menor a 1', () => {
      expect(
        createPromotionSchema.safeParse({
          ...validPromotion,
          kind: 'porcentaje',
          value: 101,
        }).success,
      ).toBe(false);

      expect(
        createPromotionSchema.safeParse({
          ...validPromotion,
          kind: 'porcentaje',
          value: 0,
        }).success,
      ).toBe(false);
    });

    it('permite monto fijo mayor a 100 siempre que sea entero positivo', () => {
      const parsed = createPromotionSchema.safeParse({
        ...validPromotion,
        kind: 'monto_fijo',
        value: 1500,
      });
      expect(parsed.success).toBe(true);
    });

    it('rechaza endsAt anterior o igual a startsAt', () => {
      expect(
        createPromotionSchema.safeParse({
          ...validPromotion,
          startsAt: '2026-11-20T10:00:00-04:00',
          endsAt: '2026-11-20T10:00:00-04:00',
        }).success,
      ).toBe(false);

      expect(
        createPromotionSchema.safeParse({
          ...validPromotion,
          startsAt: '2026-11-20T10:00:00-04:00',
          endsAt: '2026-11-20T09:00:00-04:00',
        }).success,
      ).toBe(false);
    });

    it('rechaza lista vacía de productIds o mayor a 100', () => {
      expect(
        createPromotionSchema.safeParse({
          ...validPromotion,
          productIds: [],
        }).success,
      ).toBe(false);

      const tooMany = Array.from(
        { length: 101 },
        (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      );
      expect(
        createPromotionSchema.safeParse({
          ...validPromotion,
          productIds: tooMany,
        }).success,
      ).toBe(false);
    });

    it('rechaza productIds duplicados', () => {
      expect(
        createPromotionSchema.safeParse({
          ...validPromotion,
          productIds: [
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000001',
          ],
        }).success,
      ).toBe(false);
    });
  });

  describe('updatePromotionSchema', () => {
    it('exige al menos un campo a modificar', () => {
      expect(updatePromotionSchema.safeParse({}).success).toBe(false);
    });

    it('permite cambiar solo isActive', () => {
      const parsed = updatePromotionSchema.safeParse({ isActive: false });
      expect(parsed.success).toBe(true);
    });

    it('permite cambiar solo el nombre', () => {
      const parsed = updatePromotionSchema.safeParse({ name: 'Nuevo nombre' });
      expect(parsed.success).toBe(true);
    });

    it('valida endsAt posterior a startsAt si ambos se proporcionan', () => {
      expect(
        updatePromotionSchema.safeParse({
          startsAt: '2026-11-20T10:00:00-04:00',
          endsAt: '2026-11-20T09:00:00-04:00',
        }).success,
      ).toBe(false);
    });

    it('valida porcentaje <= 100 si kind es porcentaje', () => {
      expect(
        updatePromotionSchema.safeParse({
          kind: 'porcentaje',
          value: 105,
        }).success,
      ).toBe(false);
    });
  });

  describe('promotionSchema', () => {
    it('valida una entidad completa de promoción', () => {
      const entity = {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Promo 1',
        kind: 'porcentaje',
        value: 15,
        startsAt: '2026-11-20T00:00:00-04:00',
        endsAt: null,
        isActive: true,
        productIds: ['00000000-0000-0000-0000-000000000001'],
        createdAt: '2026-11-20T00:00:00.000Z',
        updatedAt: '2026-11-20T00:00:00.000Z',
      };
      const parsed = promotionSchema.safeParse(entity);
      expect(parsed.success).toBe(true);
    });
  });
});
