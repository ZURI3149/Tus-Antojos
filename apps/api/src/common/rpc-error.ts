import type { PostgrestError } from '@supabase/supabase-js';
import { AppException } from './app-exception.js';

/** Errores de regla de negocio lanzados por los RPC: `raise exception '<CODIGO>' using errcode = 'P0001'`. */
const BUSINESS_RULE_SQLSTATE = 'P0001';
const UNIQUE_VIOLATION_SQLSTATE = '23505';

function parseJsonObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Traduce un error de PostgREST/RPC al formato de la API (spec §3.4).
 * Solo P0001 expone información al cliente (el código que eligió el autor del RPC);
 * el resto se trata como error interno y su mensaje original solo va al log.
 */
export function mapRpcError(error: PostgrestError): AppException {
  if (error.code === BUSINESS_RULE_SQLSTATE) {
    const context = error.details ? parseJsonObject(error.details) : undefined;
    return new AppException(
      'BUSINESS_RULE',
      undefined,
      context ? { reason: error.message, context } : { reason: error.message },
      { cause: error },
    );
  }

  if (error.code === UNIQUE_VIOLATION_SQLSTATE) {
    return new AppException('CONFLICT', undefined, undefined, { cause: error });
  }

  return new AppException('INTERNAL', undefined, undefined, { cause: error });
}
