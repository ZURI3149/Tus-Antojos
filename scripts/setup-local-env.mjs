// Crea apps/api/.env y apps/web/.env para el entorno LOCAL a partir de `supabase status`.
// - No sobrescribe archivos existentes.
// - No imprime claves.
// - Solo sirve para el Supabase local (Docker): las claves de la nube se cargan en
//   cada plataforma (ver docs/deployment.md).
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

let status;
try {
  status = execFileSync('supabase', ['status', '-o', 'env'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch {
  console.error('Supabase local no está corriendo. Ejecuta `pnpm db:start` primero.');
  process.exit(1);
}

const vars = Object.fromEntries(
  [...status.matchAll(/^([A-Z0-9_]+)="?(.*?)"?$/gm)].map((m) => [m[1], m[2]]),
);
const apiUrl = vars.API_URL;
const publicKey = vars.PUBLISHABLE_KEY || vars.ANON_KEY;
const serviceRoleKey = vars.SERVICE_ROLE_KEY;
if (!apiUrl || !publicKey || !serviceRoleKey) {
  console.error('`supabase status` no devolvió API_URL, la clave pública o SERVICE_ROLE_KEY.');
  process.exit(1);
}

const files = [
  {
    path: 'apps/api/.env',
    mode: 0o600,
    content: `# Generado por \`pnpm env:local\` para el entorno LOCAL. No se versiona.
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:5173
APP_VERSION=local

SUPABASE_URL=${apiUrl}
# SECRETA (aunque sea local): solo para la API.
SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}

SENTRY_DSN=
SENTRY_ENVIRONMENT=
`,
  },
  {
    path: 'apps/web/.env',
    mode: 0o644,
    content: `# Generado por \`pnpm env:local\` para el entorno LOCAL. No se versiona.
# Variables PÚBLICAS: van dentro del bundle del navegador.
VITE_SUPABASE_URL=${apiUrl}
VITE_SUPABASE_ANON_KEY=${publicKey}
VITE_API_URL=http://localhost:3000
VITE_SENTRY_DSN=
`,
  },
];

for (const file of files) {
  if (existsSync(file.path)) {
    console.log(`${file.path} ya existe; no se modifica.`);
    continue;
  }
  writeFileSync(file.path, file.content, { mode: file.mode, flag: 'wx' });
  console.log(`Creado ${file.path}`);
}
