import type { PostgrestError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { ordersError } from './orders-error.js';

const pgError = (code: string, message = '', details = ''): PostgrestError =>
  ({ code, message, details, hint: '', name: 'PostgrestError' }) as PostgrestError;

describe('ordersError', () => {
  it('traduce ORDER_NOT_FOUND a 404', () => {
    const err = ordersError(pgError('P0001', 'ORDER_NOT_FOUND'));
    expect(err.code).toBe('NOT_FOUND');
    expect(err.getStatus()).toBe(404);
  });

  it('traduce PRODUCT_NOT_FOUND a 404', () => {
    const err = ordersError(pgError('P0001', 'PRODUCT_NOT_FOUND'));
    expect(err.code).toBe('NOT_FOUND');
    expect(err.getStatus()).toBe(404);
  });

  it('traduce IDEMPOTENCY_KEY_REUSED a 409', () => {
    const err = ordersError(pgError('P0001', 'IDEMPOTENCY_KEY_REUSED'));
    expect(err.code).toBe('CONFLICT');
    expect(err.getStatus()).toBe(409);
  });

  it('traduce ORDER_CANCEL_FORBIDDEN a 403', () => {
    const err = ordersError(pgError('P0001', 'ORDER_CANCEL_FORBIDDEN'));
    expect(err.code).toBe('FORBIDDEN');
    expect(err.getStatus()).toBe(403);
  });

  it('traduce PRODUCT_INACTIVE a 422 BUSINESS_RULE', () => {
    const err = ordersError(pgError('P0001', 'PRODUCT_INACTIVE'));
    expect(err.code).toBe('BUSINESS_RULE');
    expect(err.getStatus()).toBe(422);
    expect(err.message).toBe('El producto no está activo para la venta');
  });

  it('traduce INVALID_STATUS_TRANSITION a 422 BUSINESS_RULE', () => {
    const err = ordersError(pgError('P0001', 'INVALID_STATUS_TRANSITION'));
    expect(err.code).toBe('BUSINESS_RULE');
    expect(err.getStatus()).toBe(422);
  });
});
