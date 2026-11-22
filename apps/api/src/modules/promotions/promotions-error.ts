import type { PostgrestError } from '@supabase/supabase-js';
import { promotionRuleMessage } from '@tus-antojos/shared';
import { AppException } from '../../common/app-exception.js';
import { mapRpcError } from '../../common/rpc-error.js';

const UNIQUE_VIOLATION = '23505';

/**
 * Traduce un error de la BD de promociones al formato de la API (spec promotions §3.1):
 * - PRODUCT_NOT_FOUND (P0001) → 404 NOT_FOUND 'Producto no encontrado';
 * - PROMOTION_NOT_FOUND (P0001) → 404 NOT_FOUND 'Promoción no encontrada';
 * - PROMOTION_NAME_TAKEN (P0001 o 23505) → 409 CONFLICT 'Ya existe una promoción activa con este nombre';
 * - otras reglas (P0001) → 422 BUSINESS_RULE con el mensaje en español de shared y details;
 * - lo demás → como mapRpcError (500 INTERNAL sin detalles para el cliente).
 */
export function promotionsError(error: PostgrestError): AppException {
  const cause = { cause: error };

  if (error.code === 'P0001') {
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return new AppException('NOT_FOUND', 'Producto no encontrado', undefined, cause);
    }
    if (error.message === 'PROMOTION_NOT_FOUND') {
      return new AppException('NOT_FOUND', 'Promoción no encontrada', undefined, cause);
    }
    if (error.message === 'PROMOTION_NAME_TAKEN') {
      return new AppException(
        'CONFLICT',
        'Ya existe una promoción activa con este nombre',
        undefined,
        cause,
      );
    }
    const mapped = mapRpcError(error);
    const reason = (mapped.details as { reason: string } | undefined)?.reason ?? error.message;
    const message = promotionRuleMessage(reason) ?? error.message;
    return new AppException('BUSINESS_RULE', message, mapped.details, cause);
  }

  if (error.code === UNIQUE_VIOLATION) {
    return new AppException(
      'CONFLICT',
      'Ya existe una promoción activa con este nombre',
      undefined,
      cause,
    );
  }

  return mapRpcError(error);
}
