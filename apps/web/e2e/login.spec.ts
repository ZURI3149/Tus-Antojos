import { expect, test } from '@playwright/test';
import { expectOnLogin, login, SEED_USERS } from './support';

// PL-03: cada usuario del seed inicia sesión y llega a su pantalla, contra Supabase local real.

for (const [role, user] of Object.entries(SEED_USERS)) {
  test(`${role} inicia sesión y llega a ${user.home}`, async ({ page }) => {
    await page.goto('/');
    await expectOnLogin(page);

    await login(page, user.email);

    await expect(page).toHaveURL(new RegExp(`${user.home}$`));
    await expect(page.getByRole('heading', { level: 1, name: user.heading })).toBeVisible();
    await expect(page.getByText(user.name)).toBeVisible();
    await expect(page.locator('[data-slot="role-badge"]')).toHaveText(user.label);
  });
}

test('credenciales incorrectas muestran un error genérico', async ({ page }) => {
  await page.goto('/login');
  await login(page, SEED_USERS.cajero.email, 'contraseña-incorrecta');

  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
  await expectOnLogin(page);
  await expect(page.getByLabel('Contraseña')).toHaveValue('');
});

test('cocina que entra a /admin termina en /sin-acceso', async ({ page }) => {
  await page.goto('/login');
  await login(page, SEED_USERS.cocina.email);
  await expect(page).toHaveURL(/\/cocina$/);

  await page.goto('/admin');

  await expect(page).toHaveURL(/\/sin-acceso$/);
  await expect(page.getByRole('heading', { name: 'Sin acceso' })).toBeVisible();
  await page.getByRole('link', { name: 'Ir a mi inicio' }).click();
  await expect(page).toHaveURL(/\/cocina$/);
});

test('sin sesión, una ruta protegida lleva a /login y luego de vuelta', async ({ page }) => {
  await page.goto('/cocina');
  await expectOnLogin(page);

  await login(page, SEED_USERS.admin.email);

  await expect(page).toHaveURL(/\/cocina$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Cocina' })).toBeVisible();
});

test('la sesión sobrevive a recargar la página', async ({ page }) => {
  await page.goto('/login');
  await login(page, SEED_USERS.cajero.email);
  await expect(page).toHaveURL(/\/caja$/);

  await page.reload();

  await expect(page).toHaveURL(/\/caja$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Caja' })).toBeVisible();
});

test('cerrar sesión vuelve a /login y protege las rutas otra vez', async ({ page }) => {
  await page.goto('/login');
  await login(page, SEED_USERS.admin.email);
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expectOnLogin(page);

  await page.goto('/admin');
  await expectOnLogin(page);
});
