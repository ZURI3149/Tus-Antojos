import type { PostgrestError } from '@supabase/supabase-js';
import { inventoryRuleMessage } from '@tus-antojos/shared';
import { AppException } from '../../common/app-exception.js';
import { mapRpcError } from '../../common/rpc-error.js';

/**
 * Traduce un error de la BD de inventario al formato de la API (spec §3.1 y §3.4):
 * - INGREDIENT_NOT_FOUND (P0001) → 404 NOT_FOUND 'Insumo no encontrado';
 * - reglas (P0001) → 422 BUSINESS_RULE con el mensaje en español de shared y details;
 * - lo demás → como mapRpcError (500 INTERNAL sin detalles para el cliente).
 */
export function inventoryError(error: PostgrestError): AppException {
  const cause = { cause: error };

  if (error.code === 'P0001') {
    if (error.message === 'INGREDIENT_NOT_FOUND') {
      return new AppException('NOT_FOUND', 'Insumo no encontrado', undefined, cause);
    }
    const mapped = mapRpcError(error);
    const reason = (mapped.details as { reason: string } | undefined)?.reason ?? error.message;
    const message = inventoryRuleMessage(reason) ?? error.message;
    return new AppException('BUSINESS_RULE', message, mapped.details, cause);
  }

  return mapRpcError(error);
}
