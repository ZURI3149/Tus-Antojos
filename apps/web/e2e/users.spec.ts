import { expect, test } from '@playwright/test';
import { E2E_EMAIL_PREFIX } from './global-setup';
import { expectOnLogin, login, loginAs, SEED_USERS } from './support';

// PL-08: un admin crea un cajero desde /admin/usuarios y ese usuario entra de inmediato.
// Recorre web → API NestJS → Supabase Auth → trigger de perfiles → RLS.

const PASSWORD = 'clave-e2e-segura';

test('admin crea un cajero que inicia sesión de inmediato, y luego lo desactiva', async ({
  page,
  browser,
}) => {
  const email = `${E2E_EMAIL_PREFIX}cajero-${Date.now()}@tusantojos.test`;

  await page.goto('/login');
  await login(page, SEED_USERS.admin.email);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('link', { name: /Usuarios/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();

  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  const form = page.getByRole('form', { name: 'Nuevo usuario' });
  await form.getByLabel('Nombre').fill('Cajero E2E');
  await form.getByLabel('Correo').fill(email);
  await form.getByLabel('Contraseña').fill(PASSWORD);
  await form.getByLabel('Rol').selectOption('cajero');
  await form.getByRole('button', { name: 'Crear usuario' }).click();

  await expect(page.getByText('Usuario creado')).toBeVisible();
  const row = page.getByRole('row', { name: /Cajero E2E/ });
  await expect(row).toContainText(email);
  await expect(row.getByText('Activo')).toBeVisible();

  // El nuevo cajero entra en otro navegador (sesión independiente).
  const other = await browser.newContext();
  const cajero = await other.newPage();
  await cajero.goto('/login');
  await login(cajero, email, PASSWORD);
  await expect(cajero).toHaveURL(/\/caja$/);
  await expect(cajero.getByText('Cajero E2E')).toBeVisible();

  // El admin lo desactiva; al recargar, el cajero ya no entra.
  await row.getByRole('button', { name: 'Desactivar' }).click();
  await expect(row.getByText('Inactivo')).toBeVisible();
  await cajero.reload();
  await expect(
    cajero.getByRole('heading', { name: /Usuario desactivado|Iniciar sesión/ }),
  ).toBeVisible();
  await other.close();
});

test('correo repetido se muestra en el campo Correo', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/admin/usuarios');

  await page.getByRole('button', { name: 'Nuevo usuario' }).click();
  const form = page.getByRole('form', { name: 'Nuevo usuario' });
  await form.getByLabel('Nombre').fill('Repetido');
  await form.getByLabel('Correo').fill(SEED_USERS.cajero.email);
  await form.getByLabel('Contraseña').fill(PASSWORD);
  await form.getByRole('button', { name: 'Crear usuario' }).click();

  await expect(form.getByText('Ya existe un usuario con ese correo')).toBeVisible();
});

test('la fila del propio admin no permite cambiar su rol ni desactivarse', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/admin/usuarios');

  const own = page.getByRole('row', { name: /Admin de Prueba/ });
  await expect(own.getByText('(tú)')).toBeVisible();
  await expect(own.getByLabel('Rol de Admin de Prueba')).toBeDisabled();
  await expect(own.getByRole('button', { name: 'Desactivar' })).toBeDisabled();
});

test('cajero no puede entrar a /admin/usuarios', async ({ page }) => {
  await loginAs(page, 'cajero');
  await page.goto('/admin/usuarios');
  await expect(page).toHaveURL(/\/sin-acceso$/);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expectOnLogin(page);
});
