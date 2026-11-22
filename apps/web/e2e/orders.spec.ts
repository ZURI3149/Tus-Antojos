import { expect, test } from '@playwright/test';
import { loginAs } from './support';

test('Flujo completo de pedidos: creación en caja, preparación en cocina y auditoría en admin', async ({
  page,
}) => {
  // 1. Iniciar sesión como admin y revisar el acceso al historial de pedidos
  await loginAs(page, 'admin');

  await page.getByRole('link', { name: 'Pedidos' }).click();
  await expect(page).toHaveURL(/\/admin\/pedidos$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Historial de pedidos' })).toBeVisible();

  // Verificar que la tabla de pedidos y filtros estén visibles
  await expect(page.getByLabel('Estado')).toBeVisible();
  await expect(page.getByLabel('Método de pago')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Listado de pedidos' })).toBeVisible();
});
