import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';

export interface DbTestEnv {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  dbUrl: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    dbTestEnv: DbTestEnv;
  }
}

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/** Lee las credenciales del Supabase local (`supabase status`). No usa .env ni secretos reales. */
function readLocalSupabase(): DbTestEnv {
  let output: string;
  try {
    output = execFileSync('supabase', ['status', '-o', 'env'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error(
      'Supabase local no está corriendo. Ejecuta `pnpm db:start` y vuelve a intentar.',
    );
  }

  const vars = Object.fromEntries(
    output
      .split('\n')
      .map((line) => line.match(/^([A-Z0-9_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );

  const env = {
    apiUrl: vars.API_URL,
    anonKey: vars.PUBLISHABLE_KEY || vars.ANON_KEY,
    serviceRoleKey: vars.SECRET_KEY || vars.SERVICE_ROLE_KEY,
    dbUrl: vars.DB_URL,
  };
  const missing = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`\`supabase status\` no devolvió: ${missing.join(', ')}`);
  }
  return env as DbTestEnv;
}

export default function setup(project: TestProject): void {
  project.provide('dbTestEnv', readLocalSupabase());
}
