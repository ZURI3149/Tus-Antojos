import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(emptyToUndefined, schema.optional());

const envSchema = z.object({
  NODE_ENV: optional(z.enum(['development', 'test', 'production'])).default('development'),
  PORT: optional(z.coerce.number().int().min(1).max(65535)).default(3000),
  LOG_LEVEL: optional(
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']),
  ).default('info'),
  CORS_ORIGINS: optional(z.string()).default('http://localhost:5173'),
  APP_VERSION: optional(z.string()).default('0.0.0-dev'),
  SUPABASE_URL: z.preprocess(emptyToUndefined, z.url()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().min(1)),
  SUPABASE_JWKS_URL: optional(z.url()),
  SUPABASE_JWT_SECRET: optional(z.string().min(1)),
  SUPABASE_JWT_ISSUER: optional(z.url()),
  SENTRY_DSN: optional(z.url()),
  SENTRY_ENVIRONMENT: optional(z.string()),
});

export type LogLevel = z.infer<typeof envSchema>['LOG_LEVEL'];

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: LogLevel;
  corsOrigins: string[];
  appVersion: string;
  supabase: {
    url: string;
    serviceRoleKey: string;
    jwksUrl: string;
    jwtSecret: string | undefined;
    jwtIssuer: string;
  };
  sentry: {
    dsn: string | undefined;
    environment: string;
  };
}

export class EnvValidationError extends Error {
  constructor(readonly issues: { variable: string; message: string }[]) {
    super(
      'Variables de entorno inválidas o faltantes:\n' +
        issues.map((i) => `  - ${i.variable}: ${i.message}`).join('\n'),
    );
    this.name = 'EnvValidationError';
  }
}

/** Valida y normaliza el entorno. Lanza EnvValidationError sin incluir valores (pueden ser secretos). */
export function loadEnv(source: Record<string, string | undefined>): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => ({
        variable: String(issue.path[0] ?? '(desconocida)'),
        message: issue.input === undefined ? 'es requerida' : 'valor inválido',
      })),
    );
  }

  const env = result.data;
  const supabaseUrl = env.SUPABASE_URL.replace(/\/+$/, '');

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    appVersion: env.APP_VERSION,
    supabase: {
      url: supabaseUrl,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      jwksUrl: env.SUPABASE_JWKS_URL ?? `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      jwtSecret: env.SUPABASE_JWT_SECRET,
      jwtIssuer: env.SUPABASE_JWT_ISSUER ?? `${supabaseUrl}/auth/v1`,
    },
    sentry: {
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    },
  };
}
