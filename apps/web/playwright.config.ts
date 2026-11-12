import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const PORT = 5180;
const API_PORT = 3100;
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Claves del Supabase LOCAL (`supabase status`); no usa .env ni secretos reales.
 * La service role key local solo va a la API de prueba y a la limpieza de usuarios.
 */
function localSupabase(): { url: string; anonKey: string; serviceRoleKey: string } {
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
  const url = vars.API_URL;
  const anonKey = vars.PUBLISHABLE_KEY || vars.ANON_KEY;
  const serviceRoleKey = vars.SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('`supabase status` no devolvió API_URL, la clave pública o SERVICE_ROLE_KEY');
  }
  return { url, anonKey, serviceRoleKey };
}

const supabase = localSupabase();
const isCI = Boolean(process.env.CI);

// Para e2e/global-setup.ts (limpieza de usuarios creados por las pruebas).
process.env.E2E_SUPABASE_URL = supabase.url;
process.env.E2E_SUPABASE_SERVICE_ROLE_KEY = supabase.serviceRoleKey;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // Comparten la base local (y T14 crea usuarios): en serie, sin sorpresas.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-419',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // API real (compilada) contra Supabase local.
      command:
        'pnpm --filter @tus-antojos/shared build && pnpm --filter @tus-antojos/api build && node dist/main.js',
      cwd: '../api',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn',
        PORT: String(API_PORT),
        CORS_ORIGINS: `http://localhost:${PORT}`,
        SUPABASE_URL: supabase.url,
        SUPABASE_SERVICE_ROLE_KEY: supabase.serviceRoleKey,
      },
    },
    {
      command: `pnpm exec vite --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        VITE_SUPABASE_URL: supabase.url,
        VITE_SUPABASE_ANON_KEY: supabase.anonKey,
        VITE_API_URL: `http://localhost:${API_PORT}`,
      },
    },
  ],
});
