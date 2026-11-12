import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import type { Options } from 'pino-http';
import type { AppConfig } from '../config/env.schema.js';

export const REQUEST_ID_HEADER = 'x-request-id';

const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Reutiliza el x-request-id del cliente si es seguro; si no, genera uno nuevo. */
export function resolveRequestId(value: unknown): string {
  return typeof value === 'string' && VALID_REQUEST_ID.test(value) ? value : randomUUID();
}

/**
 * Rutas que pino reemplaza por "[REDACTED]". pino no admite comodines de
 * profundidad arbitraria: se cubren hasta dos niveles de anidación.
 */
const SENSITIVE_KEYS = ['password', 'token', 'access_token', 'refresh_token', 'serviceRoleKey'];

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers.apikey',
  'res.headers["set-cookie"]',
  ...SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
];

export function buildLoggerParams(
  config: AppConfig,
  destination: DestinationStream | null,
): Params {
  const options: Options = {
    level: config.logLevel,
    base: { service: 'tus-antojos-api', version: config.appVersion },
    customAttributeKeys: { reqId: 'requestId' },
    // Los logs de la app dentro de una petición llevan solo el requestId, no el req completo.
    quietReqLogger: true,
    genReqId: (req, res) => {
      const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
      res.setHeader(REQUEST_ID_HEADER, id);
      return id;
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    autoLogging: {
      // Las plataformas sondean /health cada pocos segundos: no aporta en los logs.
      ignore: (req: IncomingMessage) => req.url === '/health',
    },
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  };

  if (destination) {
    return { pinoHttp: [options, destination] };
  }

  if (config.nodeEnv === 'development') {
    options.transport = { target: 'pino-pretty', options: { singleLine: true } };
  }
  return { pinoHttp: options };
}
