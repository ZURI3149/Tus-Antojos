import type { PostgrestError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { catalogError } from './catalog-error.js';

const pgError = (code: string, message = '', details = ''): PostgrestError =>
  ({ code, message, details, hint: '', name: 'PostgrestError' }) as PostgrestError;

describe('catalogError', () => {
  it('regla conocida → 422 con mensaje en español y el contexto de la BD', () => {
    const error = catalogError(
      pgError('P0001', 'INGREDIENT_IN_USE', '{"products":["Cono"]}'),
      'dup',
    );
    expect(error.code).toBe('BUSINESS_RULE');
    expect(error.message).toBe('El insumo se usa en productos activos');
    expect(error.details).toEqual({
      reason: 'INGREDIENT_IN_USE',
      context: { products: ['Cono'] },
    });
  });

  it('regla desconocida → 422 con el mensaje genérico', () => {
    const error = catalogError(pgError('P0001', 'OTRA_REGLA'), 'dup');
    expect(error.code).toBe('BUSINESS_RULE');
    expect(error.details).toEqual({ reason: 'OTRA_REGLA' });
  });

  it('PRODUCT_NOT_FOUND → 404', () => {
    const error = catalogError(pgError('P0001', 'PRODUCT_NOT_FOUND'), 'dup');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.getStatus()).toBe(404);
  });

  it('nombre repetido → 409 con el mensaje indicado', () => {
    const error = catalogError(pgError('23505'), 'Ya existe una categoría con ese nombre');
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toBe('Ya existe una categoría con ese nombre');
  });

  it('referencia inexistente → 400', () => {
    expect(catalogError(pgError('23503'), 'dup').code).toBe('VALIDATION_ERROR');
  });

  it('cualquier otro error → 500 sin exponer el mensaje original', () => {
    const error = catalogError(pgError('42P01', 'relation "x" does not exist'), 'dup');
    expect(error.code).toBe('INTERNAL');
    expect(error.message).not.toContain('relation');
  });
});
