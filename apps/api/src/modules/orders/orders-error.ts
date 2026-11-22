import type { PostgrestError } from '@supabase/supabase-js';
import { orderRuleMessage } from '@tus-antojos/shared';
import { AppException } from '../../common/app-exception.js';
import { mapRpcError } from '../../common/rpc-error.js';

export function ordersError(error: PostgrestError): AppException {
  const cause = { cause: error };

  if (error.code === 'P0001') {
    if (error.message === 'ORDER_NOT_FOUND') {
      return new AppException('NOT_FOUND', 'Pedido no encontrado', undefined, cause);
    }
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return new AppException('NOT_FOUND', 'Producto no encontrado', undefined, cause);
    }
    if (error.message === 'IDEMPOTENCY_KEY_REUSED') {
      return new AppException(
        'CONFLICT',
        'La clave de idempotencia ya fue usada con otro contenido',
        undefined,
        cause,
      );
    }
    if (error.message === 'ORDER_CANCEL_FORBIDDEN') {
      return new AppException(
        'FORBIDDEN',
        'No tienes permiso para anular este pedido',
        undefined,
        cause,
      );
    }

    const mapped = mapRpcError(error);
    const reason = (mapped.details as { reason: string } | undefined)?.reason ?? error.message;
    const message = orderRuleMessage(reason) ?? error.message;
    return new AppException('BUSINESS_RULE', message, mapped.details, cause);
  }

  return mapRpcError(error);
}
