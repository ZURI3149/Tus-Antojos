import { HttpException } from '@nestjs/common';
import {
  API_ERROR_HTTP_STATUS,
  type ApiErrorCode,
  type ValidationIssue,
} from '@tus-antojos/shared';

export const DEFAULT_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: 'Datos inválidos',
  UNAUTHENTICATED: 'No autenticado',
  FORBIDDEN: 'No tienes permiso para realizar esta acción',
  NOT_FOUND: 'Recurso no encontrado',
  CONFLICT: 'El recurso entra en conflicto con uno existente',
  BUSINESS_RULE: 'La operación no cumple una regla del negocio',
  INTERNAL: 'Error interno del servidor',
};

export type ApiErrorDetails = ValidationIssue[] | Record<string, unknown>;

/** Error de la API con el formato del spec §3.3. Es lo que deben lanzar los servicios. */
export class AppException extends HttpException {
  constructor(
    readonly code: ApiErrorCode,
    message: string = DEFAULT_ERROR_MESSAGES[code],
    readonly details?: ApiErrorDetails,
    options?: { cause?: unknown },
  ) {
    super(message, API_ERROR_HTTP_STATUS[code], options);
    this.name = 'AppException';
  }
}

/** Código de error para un estado HTTP de una excepción que no es AppException. */
export function errorCodeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'BUSINESS_RULE';
    default:
      // Otros 4xx (400, 405, 413, 415...) son problemas de la petición del cliente.
      return status >= 400 && status < 500 ? 'VALIDATION_ERROR' : 'INTERNAL';
  }
}
