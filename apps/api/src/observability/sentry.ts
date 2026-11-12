import * as Sentry from '@sentry/nestjs';
import type { AppConfig } from '../config/env.schema.js';

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie', 'apikey', 'x-api-key'];

/** Quita datos sensibles antes de enviar un evento a Sentry. */
export function scrubEvent<T extends Sentry.Event>(event: T): T {
  if (event.request) {
    const headers = event.request.headers;
    if (headers) {
      for (const name of Object.keys(headers)) {
        if (SENSITIVE_HEADERS.includes(name.toLowerCase())) delete headers[name];
      }
    }
    delete event.request.cookies;
    delete event.request.data; // el cuerpo puede traer contraseñas
  }
  if (event.user) {
    // Solo el id: ni correo ni IP.
    event.user = event.user.id === undefined ? {} : { id: event.user.id };
  }
  return event;
}

/**
 * Activa Sentry solo si hay SENTRY_DSN. Sin DSN no hace nada y la API funciona igual.
 * Se llama en main.ts antes de crear la app. `overrides` existe para las pruebas.
 */
export function initSentry(
  config: AppConfig,
  overrides: Partial<Sentry.NodeOptions> = {},
): boolean {
  if (!config.sentry.dsn) return false;
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    release: config.appVersion,
    // Recolección mínima (SDK 11): nada de cookies, cuerpos, query ni datos del usuario;
    // de los encabezados, solo los útiles para diagnosticar. beforeSend limpia además.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { allow: ['x-request-id', 'user-agent', 'content-type'] },
        response: false,
      },
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
    ...overrides,
  });
  return true;
}

/** Envía un error del servidor (5xx) con el requestId para cruzarlo con los logs. */
export function captureServerError(error: unknown, requestId: string): void {
  Sentry.withScope((scope) => {
    scope.setTag('request_id', requestId);
    Sentry.captureException(error);
  });
}
