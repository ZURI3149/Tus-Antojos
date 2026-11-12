// Crea un usuario ADMIN en Supabase (la nube o local). Pensado para el primer
// admin de un proyecto nuevo: el seed no corre en la nube y el panel de Supabase
// no permite fijar app_metadata.role.
//
// Uso:
//   pnpm --filter @tus-antojos/api admin:create --credentials <archivo> --email <correo> --name "<nombre>"
//
// <archivo> contiene SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (no se versiona).
// La contraseña se pide sin mostrarla. Para uso no interactivo: ADMIN_PASSWORD.
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

// pnpm pasa el `--` de `pnpm admin:create -- --email ...` tal cual: se ignora.
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();

const { values } = parseArgs({
  args,
  options: {
    credentials: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
  },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (values.credentials) process.loadEnvFile(values.credentials);
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey)
  fail('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (usa --credentials <archivo>).');

const email = values.email?.trim().toLowerCase();
const fullName = values.name?.trim();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Indica un --email válido.');
if (!fullName) fail('Indica el nombre con --name "Nombre Apellido".');

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) stdout.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      stdout.write('\n');
      resolve(answer);
    });
  });
}

let password = process.env.ADMIN_PASSWORD;
if (!password) {
  if (!stdin.isTTY) fail('Sin terminal interactiva: define ADMIN_PASSWORD.');
  password = await askHidden('Contraseña (mínimo 8 caracteres): ');
  const confirm = await askHidden('Repite la contraseña: ');
  if (password !== confirm) fail('Las contraseñas no coinciden.');
}
if (password.length < 8 || password.length > 72)
  fail('La contraseña debe tener entre 8 y 72 caracteres.');

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role: 'admin' },
  user_metadata: { full_name: fullName },
});
if (error) fail(`No se pudo crear el admin: ${error.message}`);
console.log(`Admin creado: ${email} (id ${data.user.id}). Ya puede iniciar sesión en la web.`);
