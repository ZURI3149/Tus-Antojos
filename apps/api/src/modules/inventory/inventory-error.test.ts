import type { PostgrestError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { inventoryError } from './inventory-error.js';

const pgError = (code: string, message = '', details = ''): PostgrestError =>
  ({ code, message, details, hint: '', name: 'PostgrestError' }) as PostgrestError;

describe('inventoryError', () => {
  it('INGREDIENT_NOT_FOUND (P0001) → 404 NOT_FOUND', () => {
    const error = inventoryError(pgError('P0001', 'INGREDIENT_NOT_FOUND'));
    expect(error.code).toBe('NOT_FOUND');
    expect(error.getStatus()).toBe(404);
    expect(error.message).toBe('Insumo no encontrado');
  });

  it('regla conocida de inventario → 422 BUSINESS_RULE con mensaje en español y contexto', () => {
    const error = inventoryError(pgError('P0001', 'STOCK_INSUFFICIENT', '{"available":150}'));
    expect(error.code).toBe('BUSINESS_RULE');
    expect(error.getStatus()).toBe(422);
    expect(error.message).toBe('No hay suficiente stock disponible para registrar la salida');
    expect(error.details).toEqual({
      reason: 'STOCK_INSUFFICIENT',
      context: { available: 150 },
    });
  });

  it('regla de ajuste sin cambio → 422 con mensaje', () => {
    const error = inventoryError(pgError('P0001', 'ADJUSTMENT_NO_CHANGE'));
    expect(error.code).toBe('BUSINESS_RULE');
    expect(error.getStatus()).toBe(422);
    expect(error.message).toBe('La cantidad contada es igual al stock actual');
  });

  it('PURCHASE_TOTAL_TOO_HIGH → 422 con mensaje en español', () => {
    const error = inventoryError(pgError('P0001', 'PURCHASE_TOTAL_TOO_HIGH'));
    expect(error.getStatus()).toBe(422);
    expect(error.message).toBe('El total de la compra es demasiado alto');
  });

  it('regla desconocida → 422 con mensaje de error original', () => {
    const error = inventoryError(pgError('P0001', 'CUSTOM_UNKNOWN_RULE'));
    expect(error.code).toBe('BUSINESS_RULE');
    expect(error.details).toEqual({ reason: 'CUSTOM_UNKNOWN_RULE' });
  });

  it('cualquier otro error no controlado → 500 INTERNAL sin exponer detalles', () => {
    const error = inventoryError(pgError('XX000', 'internal server panic'));
    expect(error.code).toBe('INTERNAL');
    expect(error.getStatus()).toBe(500);
    expect(error.message).not.toContain('internal server panic');
  });
});
