import { z } from 'zod';

const url = z.url().transform((value) => value.replace(/\/+$/, ''));

const schema = z.object({
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_API_URL: url,
  VITE_SENTRY_DSN: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
  VITE_SENTRY_ENVIRONMENT: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  VITE_APP_VERSION: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
});

export interface WebEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiUrl: string;
  sentryDsn: string | undefined;
  sentryEnvironment: string | undefined;
  appVersion: string | undefined;
}

/** Detecta si alguien pegó una clave secreta en el frontend (quedaría pública en el bundle). */
function looksLikeSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const [, payload] = key.split('.');
  if (!payload) return false;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: unknown;
    };
    return claims.role === 'service_role';
  } catch {
    return false;
  }
}

export function parseWebEnv(source: Record<string, unknown>): WebEnv {
  const result = schema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`Variables de entorno de la web inválidas o faltantes: ${names.join(', ')}`);
  }
  const env = result.data;
  if (looksLikeSecretKey(env.VITE_SUPABASE_ANON_KEY)) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY contiene una clave secreta (service_role). Usa la clave pública (anon/publishable).',
    );
  }
  return {
    supabaseUrl: env.VITE_SUPABASE_URL,
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
    apiUrl: env.VITE_API_URL,
    sentryDsn: env.VITE_SENTRY_DSN,
    sentryEnvironment: env.VITE_SENTRY_ENVIRONMENT,
    appVersion: env.VITE_APP_VERSION,
  };
}

let cached: WebEnv | undefined;

/** Variables públicas de la web, validadas una sola vez. */
export function getWebEnv(): WebEnv {
  cached ??= parseWebEnv(import.meta.env);
  return cached;
}
