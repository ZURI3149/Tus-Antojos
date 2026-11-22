import type { PostgrestError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { promotionsError } from './promotions-error.js';

const pgError = (code: string, message = '', details = ''): PostgrestError =>
  ({ code, message, details, hint: '', name: 'PostgrestError' }) as PostgrestError;

describe('promotionsError', () => {
  it('traduce PRODUCT_NOT_FOUND a 404 NOT_FOUND', () => {
    const err = promotionsError(pgError('P0001', 'PRODUCT_NOT_FOUND'));
    expect(err.getStatus()).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Producto no encontrado');
  });

  it('traduce PROMOTION_NOT_FOUND a 404 NOT_FOUND', () => {
    const err = promotionsError(pgError('P0001', 'PROMOTION_NOT_FOUND'));
    expect(err.getStatus()).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Promoción no encontrada');
  });

  it('traduce PROMOTION_NAME_TAKEN a 409 CONFLICT', () => {
    const err = promotionsError(pgError('P0001', 'PROMOTION_NAME_TAKEN'));
    expect(err.getStatus()).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Ya existe una promoción activa con este nombre');
  });

  it('traduce 23505 a 409 CONFLICT', () => {
    const err = promotionsError(pgError('23505', 'duplicate key value'));
    expect(err.getStatus()).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Ya existe una promoción activa con este nombre');
  });

  it('traduce errores de regla de negocio no tipados a 422 BUSINESS_RULE', () => {
    const err = promotionsError(pgError('P0001', 'CUSTOM_RULE'));
    expect(err.getStatus()).toBe(422);
    expect(err.code).toBe('BUSINESS_RULE');
    expect(err.message).toBe('CUSTOM_RULE');
  });

  it('traduce errores desconocidos a 500 INTERNAL', () => {
    const err = promotionsError(pgError('42000', 'syntax error'));
    expect(err.getStatus()).toBe(500);
    expect(err.code).toBe('INTERNAL');
  });
});
