import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const keyPath = fileURLToPath(new URL('../supabase/signing_keys.json', import.meta.url));

if (existsSync(keyPath)) {
  console.log('supabase/signing_keys.json ya existe; no se modifica.');
} else {
  const workdir = mkdtempSync(join(tmpdir(), 'tus-antojos-key-'));

  try {
    console.log('Generando clave ES256 local...');

    let output;
    if (process.platform === 'win32') {
      const command = `pnpm exec supabase gen signing-key --algorithm ES256 --workdir "${workdir}"`;
      output = execFileSync('cmd.exe', ['/d', '/s', '/c', command], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } else {
      try {
        output = execFileSync(
          'supabase',
          ['gen', 'signing-key', '--algorithm', 'ES256', '--workdir', workdir],
          {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
      } catch (err) {
        if (err && err.code === 'ENOENT') {
          output = execFileSync(
            'pnpm',
            [
              'exec',
              'supabase',
              'gen',
              'signing-key',
              '--algorithm',
              'ES256',
              '--workdir',
              workdir,
            ],
            {
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'pipe'],
            },
          );
        } else {
          throw err;
        }
      }
    }

    const key = JSON.parse(output);

    writeFileSync(keyPath, JSON.stringify(Array.isArray(key) ? key : [key], null, 2) + '\n', {
      mode: 0o600,
    });

    console.log('Clave de firma local creada correctamente.');
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}
