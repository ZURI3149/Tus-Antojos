import type { PostgrestError } from '@supabase/supabase-js';
import { catalogRuleMessage } from '@tus-antojos/shared';
import { AppException } from '../../common/app-exception.js';
import { mapRpcError } from '../../common/rpc-error.js';

const FOREIGN_KEY_VIOLATION = '23503';

/**
 * Traduce un error de la BD del catálogo al formato de la API:
 * - reglas (P0001) → 422 con el mensaje en español de `shared` (PRODUCT_NOT_FOUND → 404);
 * - nombre repetido (23505) → 409 con `conflictMessage`;
 * - referencia inexistente (23503: categoría o insumo) → 400;
 * - lo demás → como `mapRpcError` (500 sin detalles para el cliente).
 */
export function catalogError(error: PostgrestError, conflictMessage: string): AppException {
  const cause = { cause: error };

  if (error.code === 'P0001' && error.message === 'PRODUCT_NOT_FOUND') {
    return new AppException('NOT_FOUND', 'Producto no encontrado', undefined, cause);
  }
  if (error.code === FOREIGN_KEY_VIOLATION) {
    return new AppException(
      'VALIDATION_ERROR',
      'La categoría o el insumo indicado no existe',
      undefined,
      cause,
    );
  }

  const mapped = mapRpcError(error);
  if (mapped.code === 'CONFLICT') {
    return new AppException('CONFLICT', conflictMessage, undefined, cause);
  }
  if (mapped.code === 'BUSINESS_RULE') {
    const reason = (mapped.details as { reason: string }).reason;
    const message = catalogRuleMessage(reason);
    if (message) return new AppException('BUSINESS_RULE', message, mapped.details, cause);
  }
  return mapped;
}
