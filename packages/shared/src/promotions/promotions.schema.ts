import { z } from 'zod';

export const PROMOTION_KINDS = ['porcentaje', 'monto_fijo'] as const;
export type PromotionKind = (typeof PROMOTION_KINDS)[number];

export const MAX_PROMOTION_VALUE_CENTS = 100_000_000;

const noDuplicates = (ids: string[]) => new Set(ids).size === ids.length;
const hasChanges = (v: Record<string, unknown>) => Object.values(v).some((x) => x !== undefined);

const promotionNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Ingresa el nombre' })
  .max(80, { error: 'Máximo 80 caracteres' });

const promotionValueSchema = z
  .number()
  .int({ error: 'El valor debe ser un número entero' })
  .positive({ error: 'El valor debe ser mayor a 0' })
  .max(MAX_PROMOTION_VALUE_CENTS, { error: 'Valor demasiado grande' });

const promotionStartsAtSchema = z.iso.datetime({
  offset: true,
  error: 'Fecha de inicio inválida (formato ISO con offset)',
});

const promotionEndsAtSchema = z.iso.datetime({
  offset: true,
  error: 'Fecha de fin inválida (formato ISO con offset)',
});

const productIdsSchema = z
  .array(z.guid({ error: 'ID de producto inválido' }), {
    error: 'Elige al menos un producto',
  })
  .min(1, { error: 'Elige al menos un producto' })
  .max(100, { error: 'Máximo 100 productos' })
  .refine(noDuplicates, { error: 'No repitas productos' });

export const createPromotionSchema = z
  .object({
    name: promotionNameSchema,
    kind: z.enum(PROMOTION_KINDS, { error: 'Tipo de promoción inválido' }),
    value: promotionValueSchema,
    startsAt: promotionStartsAtSchema,
    endsAt: promotionEndsAtSchema.nullable().default(null),
    productIds: productIdsSchema,
  })
  .refine((data) => data.kind !== 'porcentaje' || data.value <= 100, {
    error: 'El porcentaje debe estar entre 1 y 100',
    path: ['value'],
  })
  .refine(
    (data) =>
      data.endsAt === null || new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime(),
    {
      error: 'La fecha de fin debe ser posterior a la de inicio',
      path: ['endsAt'],
    },
  );

export type CreatePromotionInput = z.input<typeof createPromotionSchema>;
export type CreatePromotion = z.output<typeof createPromotionSchema>;

export const updatePromotionSchema = z
  .strictObject({
    name: promotionNameSchema.optional(),
    kind: z.enum(PROMOTION_KINDS, { error: 'Tipo de promoción inválido' }).optional(),
    value: promotionValueSchema.optional(),
    startsAt: promotionStartsAtSchema.optional(),
    endsAt: promotionEndsAtSchema.nullable().optional(),
    productIds: productIdsSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(hasChanges, { error: 'Indica al menos un cambio' })
  .refine((data) => data.kind !== 'porcentaje' || data.value === undefined || data.value <= 100, {
    error: 'El porcentaje debe estar entre 1 y 100',
    path: ['value'],
  })
  .refine(
    (data) => {
      if (data.startsAt !== undefined && data.endsAt !== undefined && data.endsAt !== null) {
        return new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime();
      }
      return true;
    },
    {
      error: 'La fecha de fin debe ser posterior a la de inicio',
      path: ['endsAt'],
    },
  );

export type UpdatePromotion = z.output<typeof updatePromotionSchema>;

export const promotionSchema = z.object({
  id: z.guid(),
  name: z.string(),
  kind: z.enum(PROMOTION_KINDS),
  value: z.number().int(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  isActive: z.boolean(),
  productIds: z.array(z.guid()),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type Promotion = z.infer<typeof promotionSchema>;
