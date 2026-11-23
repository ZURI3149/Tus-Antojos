
// Crea apps/api/.env y apps/web/.env para el entorno LOCAL
// a partir de `supabase status`.
//
// - Compatible con Windows, Linux y macOS.
// - No sobrescribe archivos existentes.
// - No imprime claves ni secretos.
// - Solo sirve para Supabase local (Docker).
// - Las claves de producción se configuran por separado.

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

let status;

try {
  if (process.platform === 'win32') {
    // En Windows ejecutamos Supabase CLI mediante pnpm.
    status = execFileSync(
      'cmd.exe',
      ['/d', '/s', '/c', 'pnpm exec supabase status -o env'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
  } else {
    // En Linux y macOS se utiliza la CLI directamente.
    status = execFileSync(
      'supabase',
      ['status', '-o', 'env'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  }
} catch (error) {
  console.error(
    'No se pudo consultar Supabase local. Comprueba que Docker esté funcionando y ejecuta `pnpm db:start` primero.',
  );

  if (error.stderr) {
    console.error(error.stderr.toString());
  }

  process.exit(1);
}

// Extraer variables del resultado de Supabase.
const vars = Object.fromEntries(
  [...status.matchAll(/^([A-Z0-9_]+)="?(.*?)"?$/gm)].map(
    (match) => [match[1], match[2]],
  ),
);

const apiUrl = vars.API_URL;
const publicKey = vars.PUBLISHABLE_KEY || vars.ANON_KEY;
const serviceRoleKey = vars.SERVICE_ROLE_KEY;

// Comprobar que Supabase devolvió las credenciales necesarias.
if (!apiUrl || !publicKey || !serviceRoleKey) {
  console.error(
    '`supabase status` no devolvió API_URL, la clave pública o SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

// Archivos de configuración local.
const files = [
  {
    path: 'apps/api/.env',
    mode: 0o600,
    content: `# Generado por pnpm env:local para el entorno LOCAL.
# No se versiona. No compartir este archivo.

NODE_ENV=development
PORT=3000
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:5173
APP_VERSION=local

SUPABASE_URL=${apiUrl}
# CLAVE SECRETA: exclusiva del backend.
SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}

SENTRY_DSN=
SENTRY_ENVIRONMENT=
`,
  },
  {
    path: 'apps/web/.env',
    mode: 0o644,
    content: `# Generado por pnpm env:local para el entorno LOCAL.
# Variables públicas utilizadas por el navegador.

VITE_SUPABASE_URL=${apiUrl}
VITE_SUPABASE_ANON_KEY=${publicKey}
VITE_API_URL=http://localhost:3000
VITE_SENTRY_DSN=
`,
  },
];

// Crear archivos sin sobrescribir los existentes.
for (const file of files) {
  if (existsSync(file.path)) {
    console.log(`${file.path} ya existe; no se modifica.`);
    continue;
  }

  try {
    writeFileSync(file.path, file.content, {
      mode: file.mode,
      flag: 'wx',
    });

    console.log(`Creado ${file.path}`);
  } catch (error) {
    console.error(`No se pudo crear ${file.path}: ${error.message}`);
    process.exitCode = 1;
    break;
  }
}

if (!process.exitCode) {
  console.log('Configuración local de entorno completada.');
}
