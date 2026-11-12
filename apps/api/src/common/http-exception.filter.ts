import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';
import { API_ERROR_HTTP_STATUS, type ApiErrorBody } from '@tus-antojos/shared';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppException, DEFAULT_ERROR_MESSAGES, errorCodeForStatus } from './app-exception.js';
import { REQUEST_ID_HEADER, resolveRequestId } from './logger.js';
import { captureServerError } from '../observability/sentry.js';
import { mapRpcError } from './rpc-error.js';

/** Convierte cualquier error en el formato único de la API (spec §3.3). */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger(HttpExceptionFilter.name) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: unknown }>();
    const res = http.getResponse<Response>();

    const appError = this.toAppException(exception);
    const status = API_ERROR_HTTP_STATUS[appError.code];

    const requestId = this.requestIdOf(req, res);

    if (status >= 500) {
      // El detalle real va al log y a Sentry; al cliente, un mensaje genérico.
      const cause = appError.cause ?? exception;
      this.logger.error({ err: cause }, 'Error no controlado');
      captureServerError(cause, requestId);
    }

    const body: ApiErrorBody = {
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details !== undefined && { details: appError.details }),
        requestId,
      },
    };

    res.status(status).json(body);
  }

  private toAppException(exception: unknown): AppException {
    if (exception instanceof AppException) return exception;
    if (exception instanceof PostgrestError) return mapRpcError(exception);
    if (exception instanceof HttpException) {
      const code = errorCodeForStatus(exception.getStatus());
      // Mensaje propio en español: los de Nest/Express vienen en inglés.
      return new AppException(code, DEFAULT_ERROR_MESSAGES[code], undefined, {
        cause: exception,
      });
    }
    return new AppException('INTERNAL', undefined, undefined, { cause: exception });
  }

  private requestIdOf(req: Request & { id?: unknown }, res: Response): string {
    if (typeof req.id === 'string' && req.id) return req.id;
    const header = res.getHeader(REQUEST_ID_HEADER);
    if (typeof header === 'string' && header) return header;
    // Errores anteriores al middleware de pino-http (p. ej. JSON mal formado en el
    // body parser): se resuelve aquí con la misma regla y se devuelve al cliente.
    const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
    if (!res.headersSent) res.setHeader(REQUEST_ID_HEADER, id);
    return id;
  }
}
