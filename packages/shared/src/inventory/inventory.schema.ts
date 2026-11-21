import { z } from 'zod';

/**
 * Contratos del módulo de inventario (spec §4.1).
 * Cantidades siempre en unidades base enteras y costos en centavos enteros.
 * El costo unitario promedio (avgUnitCost) viaja como string decimal ("0.800000").
 */

export const INVENTORY_MOVEMENT_TYPES = [
  'compra',
  'venta',
  'merma',
  'ajuste',
  'anulacion',
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];
export const inventoryMovementTypeSchema = z.enum(INVENTORY_MOVEMENT_TYPES);

export function isIsoDate(val: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const d = new Date(`${val}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === val;
}

export function isDateNotInFuture(val: string): boolean {
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const utcToday = now.toISOString().slice(0, 10);
  const maxToday = localToday > utcToday ? localToday : utcToday;
  return val <= maxToday;
}

/** Tope del total de una compra; coincide con el CHECK de purchases.total_cents. */
export const MAX_PURCHASE_TOTAL_CENTS = 100_000_000;

export const purchaseItemSchema = z.object({
  ingredientId: z.guid({ error: 'Elige un insumo' }),
  quantity: z
    .number()
    .int({ error: 'La cantidad debe ser entera en la unidad base' })
    .positive({ error: 'La cantidad debe ser mayor a 0' })
    .max(100_000_000, { error: 'Cantidad demasiado grande' }),
  costCents: z
    .number()
    .int({ error: 'El costo debe ser un número entero de centavos' })
    .min(0, { error: 'El costo no puede ser negativo' })
    .max(100_000_000, { error: 'Costo demasiado grande' }),
});
export type PurchaseItem = z.infer<typeof purchaseItemSchema>;

export const registerPurchaseSchema = z.object({
  purchasedOn: z
    .string()
    .refine(isIsoDate, { error: 'Fecha inválida (formato YYYY-MM-DD)' })
    .refine(isDateNotInFuture, { error: 'La fecha de compra no puede ser futura' }),
  supplier: z.string().trim().max(120, { error: 'Máximo 120 caracteres' }).default(''),
  note: z.string().trim().max(500, { error: 'Máximo 500 caracteres' }).default(''),
  items: z
    .array(purchaseItemSchema)
    .min(1, { error: 'Agrega al menos un insumo' })
    .max(50, { error: 'Máximo 50 líneas por compra' })
    .refine((items) => new Set(items.map((i) => i.ingredientId)).size === items.length, {
      error: 'Un insumo aparece dos veces en la compra',
    })
    .refine((items) => items.reduce((sum, i) => sum + i.costCents, 0) <= MAX_PURCHASE_TOTAL_CENTS, {
      error: 'El total de la compra es demasiado alto',
    }),
});
export type RegisterPurchaseInput = z.input<typeof registerPurchaseSchema>;
export type RegisterPurchase = z.output<typeof registerPurchaseSchema>;

const reasonSchema = z
  .string()
  .trim()
  .min(3, { error: 'El motivo debe tener al menos 3 caracteres' })
  .max(200, { error: 'El motivo no puede superar 200 caracteres' });

export const recordWasteSchema = z.object({
  ingredientId: z.guid({ error: 'Elige un insumo' }),
  quantity: z
    .number()
    .int({ error: 'La cantidad debe ser entera en la unidad base' })
    .positive({ error: 'La cantidad debe ser mayor a 0' })
    .max(100_000_000, { error: 'Cantidad demasiado grande' }),
  reason: reasonSchema,
});
export type RecordWasteInput = z.infer<typeof recordWasteSchema>;

export const countStockSchema = z.object({
  ingredientId: z.guid({ error: 'Elige un insumo' }),
  counted: z
    .number()
    .int({ error: 'La cantidad debe ser entera en la unidad base' })
    .min(0, { error: 'La cantidad contada no puede ser negativa' })
    .max(100_000_000, { error: 'Cantidad demasiado grande' }),
  reason: reasonSchema,
});
export type CountStockInput = z.infer<typeof countStockSchema>;

export const updateStockSchema = z.strictObject({
  minQuantity: z
    .number()
    .int({ error: 'El stock mínimo debe ser entero' })
    .min(0, { error: 'El stock mínimo no puede ser negativo' })
    .max(100_000_000, { error: 'Stock mínimo demasiado grande' }),
});
export type UpdateStockInput = z.infer<typeof updateStockSchema>;

export const stockItemSchema = z.object({
  ingredientId: z.guid(),
  quantity: z.number().int(),
  avgUnitCost: z.string(),
  minQuantity: z.number().int(),
  updatedAt: z.string(),
});
export type StockItem = z.infer<typeof stockItemSchema>;

export const inventoryMovementSchema = z.object({
  id: z.number().int(),
  ingredientId: z.guid(),
  type: inventoryMovementTypeSchema,
  quantity: z.number().int(),
  costCents: z.number().int(),
  balanceQuantity: z.number().int(),
  balanceAvgUnitCost: z.string(),
  purchaseId: z.guid().nullable(),
  orderId: z.guid().nullable(),
  reason: z.string(),
  createdBy: z.guid().nullable(),
  createdAt: z.string(),
});
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;

export const purchaseSchema = z.object({
  id: z.guid(),
  purchasedOn: z.string(),
  supplier: z.string(),
  note: z.string(),
  totalCents: z.number().int(),
  createdBy: z.guid().nullable(),
  createdAt: z.string(),
  items: z.array(purchaseItemSchema).optional(),
});
export type Purchase = z.infer<typeof purchaseSchema>;
