import { expect, type Page } from '@playwright/test';

export const SEED_PASSWORD = 'TusAntojos-local-2026';

export const SEED_USERS = {
  cajero: {
    email: 'cajero@tusantojos.test',
    name: 'Cajero de Prueba',
    home: '/caja',
    heading: 'Caja',
    label: 'Cajero',
  },
  cocina: {
    email: 'cocina@tusantojos.test',
    name: 'Cocina de Prueba',
    home: '/cocina',
    heading: 'Cocina',
    label: 'Cocina',
  },
  admin: {
    email: 'admin@tusantojos.test',
    name: 'Admin de Prueba',
    home: '/admin',
    heading: 'Administración',
    label: 'Administrador',
  },
} as const;

export async function login(page: Page, email: string, password = SEED_PASSWORD): Promise<void> {
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

export async function expectOnLogin(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
}

/** Inicia sesión con un usuario del seed y espera a que llegue a su pantalla. */
export async function loginAs(page: Page, role: keyof typeof SEED_USERS): Promise<void> {
  await page.goto('/login');
  await login(page, SEED_USERS[role].email);
  await expect(page).toHaveURL(new RegExp(`${SEED_USERS[role].home}$`));
}
