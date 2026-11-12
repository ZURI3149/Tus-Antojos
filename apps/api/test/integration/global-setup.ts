import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';

export interface LocalSupabase {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    localSupabase: LocalSupabase;
  }
}

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));

export default function setup(project: TestProject): void {
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
    [...output.matchAll(/^([A-Z0-9_]+)="?(.*?)"?$/gm)].map((m) => [m[1], m[2]]),
  );
  const env = {
    apiUrl: vars.API_URL ?? '',
    anonKey: vars.PUBLISHABLE_KEY || vars.ANON_KEY || '',
    serviceRoleKey: vars.SERVICE_ROLE_KEY ?? '',
  };
  if (!env.apiUrl || !env.anonKey || !env.serviceRoleKey) {
    throw new Error('`supabase status` no devolvió API_URL, la clave pública o SERVICE_ROLE_KEY');
  }
  project.provide('localSupabase', env);
}
