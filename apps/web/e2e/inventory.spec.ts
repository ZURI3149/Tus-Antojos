import { expect, test } from '@playwright/test';
import { loginAs } from './support';

test('IN-01 e IN-08: flujo completo de compras, actualización de stock, kardex y resolución de alertas', async ({
  page,
}) => {
  await loginAs(page, 'admin');

  // 1. En /admin vemos la tarjeta de alertas inicial (del seed): Frutillas bajo mínimo
  await expect(page.getByText(/Alertas de inventario/i)).toBeVisible();
  await expect(page.getByText('Frutillas')).toBeVisible();
  await expect(page.getByText('Bajo mínimo')).toBeVisible();

  // 2. Navegar a Compras y registrar una compra que reponga Frutillas y otro insumo
  await page.getByRole('link', { name: 'Inventario' }).click();
  await expect(page).toHaveURL(/\/admin\/inventario$/);

  await page.getByRole('link', { name: 'Compras' }).click();
  await expect(page).toHaveURL(/\/admin\/compras$/);

  await page.getByRole('link', { name: /Nueva compra/i }).click();
  await expect(page).toHaveURL(/\/admin\/compras\/nueva$/);

  // Completar cabecera
  await page.getByLabel(/Proveedor/i).fill('Distribuidora San Pedro E2E');
  await page.getByLabel(/Nota/i).fill('Factura E2E reposición');

  // Línea 1: Frutillas (2000 g a Bs 30.00)
  const firstSelect = page.getByRole('combobox').first();
  await firstSelect.selectOption({ label: 'Frutillas (g)' });

  const firstQty = page.getByPlaceholder('Cantidad').first();
  await firstQty.fill('2000');

  const firstCost = page.getByPlaceholder('0.00').first();
  await firstCost.fill('30.00');

  // Línea 2: Cono de galleta (100 unidades a Bs 50.00)
  await page.getByRole('button', { name: /Agregar otra línea/i }).click();
  const secondSelect = page.getByRole('combobox').nth(1);
  await secondSelect.selectOption({ label: 'Cono de galleta (unidad)' });

  const secondQty = page.getByPlaceholder('Cantidad').nth(1);
  await secondQty.fill('100');

  const secondCost = page.getByPlaceholder('0.00').nth(1);
  await secondCost.fill('50.00');

  // Verificar total calculado en tiempo real: Bs 30,00 + Bs 50,00 = Bs 80,00
  await expect(page.getByText('Bs 80,00')).toBeVisible();

  // Registrar compra
  await page.getByRole('button', { name: 'Registrar compra' }).click();
  await expect(page).toHaveURL(/\/admin\/compras$/);
  await expect(page.getByText('Distribuidora San Pedro E2E')).toBeVisible();

  // 3. Ir a Stock e insumos: verificar que el stock de Frutillas subió y su estado es Normal.
  //    Seed: compra 2000 g − merma 500 g − pedido #2 de ejemplo 180 g = 1320 g; + 2000 g = 3320 g.
  //    (Supone una base recién creada con `pnpm db:reset`, como en el CI.)
  await page.getByRole('link', { name: 'Stock e insumos' }).click();
  await expect(page).toHaveURL(/\/admin\/inventario$/);

  const frutillasRow = page.getByRole('row', { name: /Frutillas/i });
  await expect(frutillasRow.getByText('3,32 kg')).toBeVisible();
  await expect(frutillasRow.getByText('Normal')).toBeVisible();

  // 4. Ver Kardex de Frutillas: verificar el nuevo movimiento y saldo
  await frutillasRow.getByRole('link', { name: 'Kardex' }).click();
  await expect(page.getByText('Historial de Frutillas')).toBeVisible();
  await expect(page.getByRole('cell', { name: '+2 kg' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '3,32 kg' }).first()).toBeVisible();

  // 5. Volver al panel de administración /admin: verificar que la alerta de Frutillas desapareció (IN-08)
  await page.goto('/admin');
  await expect(page.getByText('Inventario en niveles óptimos')).toBeVisible();
});
