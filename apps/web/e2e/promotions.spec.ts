import { expect, test } from '@playwright/test';
import { loginAs } from './support';

// PR-01: El admin crea una promoción del 20 % para 2 productos con vigencia futura;
// aparece como «Programada» y la vista previa muestra Bs 25,00 → Bs 20,00.
// Luego desactiva la promoción y verifica que su estado cambia a «Desactivada».

test('PR-01: creación de promoción futura con vista previa y posterior desactivación', async ({
  page,
}) => {
  await loginAs(page, 'admin');

  // 1. En /admin vemos la tarjeta de Promociones con al menos 1 vigente (del seed)
  await expect(page.getByRole('link', { name: /Promociones/i })).toBeVisible();
  await expect(page.getByText(/1 vigente/i)).toBeVisible();

  // 2. Navegar a /admin/promociones
  await page.getByRole('link', { name: /Promociones/i }).click();
  await expect(page).toHaveURL(/\/admin\/promociones$/);

  // Verificar promociones iniciales del seed
  await expect(page.getByText('Promo Verano 15%')).toBeVisible();

  // 3. Ir a Nueva promoción
  await page.getByRole('link', { name: 'Nueva promoción' }).click();
  await expect(page).toHaveURL(/\/admin\/promociones\/nueva$/);

  const promoName = `Promo E2E ${Date.now()}`;
  const form = page.getByRole('form', { name: 'Datos de la promoción' });

  // Completar nombre
  await form.getByLabel('Nombre').fill(promoName);

  // Descuento 20 % (tipo porcentaje seleccionado por defecto)
  await form.getByLabel('Porcentaje (%)').fill('20');

  // Vigencia futura (hora de Bolivia)
  await form.getByLabel('Inicio (hora de Bolivia)').fill('2029-01-01T10:00');
  await form.getByLabel('Fin (opcional)').fill('2029-01-15T22:00');

  // Seleccionar 2 productos: Torta artesanal (Bs 25,00) y Cono simple (Bs 10,00)
  await form.getByLabel('Torta artesanal').check();
  await form.getByLabel('Cono simple').check();

  // 4. Verificar vista previa en tiempo real
  const preview = page.getByRole('region', { name: 'Vista previa de precios' });
  await expect(preview.getByText('Torta artesanal')).toBeVisible();
  await expect(preview.getByText('Bs 25,00')).toBeVisible();
  await expect(preview.getByText('Bs 20,00')).toBeVisible(); // 25,00 - 20% = 20,00

  await expect(preview.getByText('Cono simple')).toBeVisible();
  await expect(preview.getByText('Bs 8,00')).toBeVisible();
  await expect(preview.getByText('Bs 6,40')).toBeVisible(); // 8,00 - 20% = 6,40

  // 5. Crear promoción y verificar redirección
  await form.getByRole('button', { name: 'Crear promoción' }).click();
  await expect(page).toHaveURL(/\/admin\/promociones$/);

  // 6. Verificar fila creada: estado Programada, 2 productos, 20 %
  const row = page.getByRole('row', { name: new RegExp(promoName) });
  await expect(row).toBeVisible();
  await expect(row.getByText('Programada')).toBeVisible();
  await expect(row.getByText('20 %')).toBeVisible();
  await expect(row.getByText('2 productos')).toBeVisible();

  // 7. Desactivar la promoción desde la tabla y verificar cambio a Desactivada
  await row.getByRole('button', { name: `Desactivar ${promoName}` }).click();
  await expect(row.getByText('Desactivada')).toBeVisible();
});
