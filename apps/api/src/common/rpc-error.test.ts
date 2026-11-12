import { PostgrestError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { AppException } from './app-exception.js';
import { mapRpcError } from './rpc-error.js';

const pgError = (code: string, message: string, details = '') =>
  new PostgrestError({ code, message, details, hint: '' });

describe('mapRpcError', () => {
  it('P0001 → BUSINESS_RULE con el código del RPC en details.reason', () => {
    const error = mapRpcError(pgError('P0001', 'PRODUCT_INACTIVE'));
    expect(error).toBeInstanceOf(AppException);
    expect(error.code).toBe('BUSINESS_RULE');
    expect(error.getStatus()).toBe(422);
    expect(error.details).toEqual({ reason: 'PRODUCT_INACTIVE' });
  });

  it('P0001 con detail JSON lo agrega como details.context', () => {
    const error = mapRpcError(
      pgError('P0001', 'INSUFFICIENT_STOCK', '{"ingredientId":"abc","missing":20}'),
    );
    expect(error.details).toEqual({
      reason: 'INSUFFICIENT_STOCK',
      context: { ingredientId: 'abc', missing: 20 },
    });
  });

  it('P0001 con detail de texto libre no lo expone', () => {
    const error = mapRpcError(pgError('P0001', 'INVALID_ROLE', 'El usuario 123 no tiene rol'));
    expect(error.details).toEqual({ reason: 'INVALID_ROLE' });
  });

  it('23505 (unicidad) → CONFLICT 409', () => {
    const error = mapRpcError(pgError('23505', 'duplicate key value violates unique constraint'));
    expect(error.code).toBe('CONFLICT');
    expect(error.getStatus()).toBe(409);
  });

  it.each(['42501', '23503', 'PGRST301', 'XX000'])(
    'cualquier otro código (%s) → INTERNAL 500 sin exponer el mensaje de la BD',
    (code) => {
      const error = mapRpcError(pgError(code, 'detalle interno de postgres'));
      expect(error.code).toBe('INTERNAL');
      expect(error.getStatus()).toBe(500);
      expect(error.message).not.toContain('postgres');
    },
  );
});
