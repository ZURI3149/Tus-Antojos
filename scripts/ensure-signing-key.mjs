// Genera supabase/signing_keys.json (clave ES256 local) si no existe.
// Ese archivo contiene una clave PRIVADA: está en .gitignore y nunca se sube.
// Solo sirve para el entorno local/CI; Supabase Cloud gestiona sus propias claves.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const path = new URL('../supabase/signing_keys.json', import.meta.url);

if (existsSync(path)) {
  console.log('supabase/signing_keys.json ya existe; no se modifica.');
} else {
  // Se genera en una carpeta vacía: con signing_keys_path en config.toml, la CLI
  // intenta leer el archivo (que aún no existe) y falla.
  const workdir = mkdtempSync(join(tmpdir(), 'tus-antojos-key-'));
  let output;
  try {
    output = execFileSync(
      'supabase',
      ['gen', 'signing-key', '--algorithm', 'ES256', '--workdir', workdir],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
  const key = JSON.parse(output);
  writeFileSync(path, JSON.stringify(Array.isArray(key) ? key : [key], null, 2) + '\n', {
    mode: 0o600,
  });
  console.log('Clave de firma local creada en supabase/signing_keys.json');
}
