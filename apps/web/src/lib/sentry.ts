import * as Sentry from '@sentry/react';
import type { WebEnv } from './env';

// Tokens que podrían aparecer en URLs (enlaces de Supabase Auth, claves en query).
const TOKEN_IN_URL = /([?#&](?:access_token|refresh_token|token|apikey|code)=)[^&#]*/gi;

function scrubUrl<T>(value: T): T {
  return (typeof value === 'string' ? value.replace(TOKEN_IN_URL, '$1[REDACTED]') : value) as T;
}

/** Quita tokens de URLs y datos personales antes de enviar un evento a Sentry. */
export function scrubWebEvent<T extends Sentry.Event>(event: T): T {
  if (event.request?.url) event.request.url = scrubUrl(event.request.url);
  for (const crumb of event.breadcrumbs ?? []) {
    if (!crumb.data) continue;
    for (const key of ['url', 'from', 'to'] as const) {
      if (key in crumb.data) crumb.data[key] = scrubUrl(crumb.data[key]);
    }
  }
  if (event.user) event.user = event.user.id === undefined ? {} : { id: event.user.id };
  return event;
}

/** Activa Sentry solo si hay VITE_SENTRY_DSN. `overrides` existe para las pruebas. */
export function initWebSentry(
  env: WebEnv,
  overrides: Partial<Sentry.BrowserOptions> = {},
): boolean {
  if (!env.sentryDsn) return false;
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.sentryEnvironment ?? import.meta.env.MODE,
    release: env.appVersion,
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
    beforeSend: (event) => scrubWebEvent(event),
    ...overrides,
  });
  return true;
}

/**
 * Registra que un pedido cobrado sin conexión se descartó a mano (SPEC-offline-print OP-D7).
 * Sin datos personales: ni nombre del cajero ni del cliente.
 */
export function reportOutboxDiscard(info: {
  clientOrderId: string;
  totalCents: number;
  attempts: number;
  lastError: string | null;
  reason: string;
}): void {
  Sentry.captureMessage('Pedido offline descartado', {
    level: 'warning',
    tags: { area: 'offline-outbox' },
    extra: info,
  });
}
