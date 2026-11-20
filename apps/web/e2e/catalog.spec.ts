import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { E2E_CATALOG_PREFIX } from './global-setup';
import { loginAs } from './support';

// CA-01: el admin crea un insumo, una categoría y un producto con receta de 2 insumos
// y foto, lo activa, y el producto aparece activo en la lista.
// Recorre web → API NestJS → RPC y triggers de la BD → Storage (URL firmada) → RLS.

const PHOTO = fileURLToPath(new URL('./fixtures/producto.png', import.meta.url));

test('CA-01: alta completa de un producto con receta y foto', async ({ page }) => {
  const id = Date.now();
  const flour = `${E2E_CATALOG_PREFIX}Harina ${id}`;
  const milk = `${E2E_CATALOG_PREFIX}Leche ${id}`;
  const category = `${E2E_CATALOG_PREFIX}Postres ${id}`;
  const product = `${E2E_CATALOG_PREFIX}Torta ${id}`;

  await loginAs(page, 'admin');
  await page.getByRole('link', { name: /Insumos/ }).click();

  // Insumos: uno por peso (la receta lo usará en kg) y otro por volumen.
  for (const [name, unit] of [
    [flour, 'Peso (g, kg)'],
    [milk, 'Volumen (ml, L)'],
  ] as const) {
    await page.getByRole('button', { name: 'Nuevo insumo' }).click();
    const form = page.getByRole('form', { name: 'Nuevo insumo' });
    await form.getByLabel('Nombre').fill(name);
    await form.getByLabel('Medida').selectOption({ label: unit });
    await form.getByRole('button', { name: 'Crear insumo' }).click();
    await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
  }

  // Categoría.
  await page
    .getByRole('navigation', { name: 'Catálogo' })
    .getByRole('link', { name: 'Categorías' })
    .click();
  await page.getByRole('button', { name: 'Nueva categoría' }).click();
  const categoryForm = page.getByRole('form', { name: 'Nueva categoría' });
  await categoryForm.getByLabel('Nombre').fill(category);
  await categoryForm.getByRole('button', { name: 'Crear categoría' }).click();
  await expect(page.getByRole('row', { name: new RegExp(category) })).toBeVisible();

  // Producto con receta (0,25 kg y 0,2 L), activo desde el alta.
  await page
    .getByRole('navigation', { name: 'Catálogo' })
    .getByRole('link', { name: 'Productos' })
    .click();
  await page.getByRole('link', { name: 'Nuevo producto' }).click();
  const form = page.getByRole('form', { name: 'Datos del producto' });
  await form.getByLabel('Nombre').fill(product);
  await form.getByLabel('Descripción').fill('De chocolate');
  await form.getByLabel('Categoría').selectOption({ label: category });
  await form.getByLabel('Precio (Bs)').fill('25,50');
  await expect(form.getByRole('switch', { name: 'Activo' })).toBeDisabled();

  await form.getByRole('button', { name: 'Agregar insumo' }).click();
  await form.getByLabel('Insumo 1', { exact: true }).selectOption({ label: flour });
  await form.getByLabel('Unidad 1', { exact: true }).selectOption('kg');
  await form.getByLabel('Cantidad 1', { exact: true }).fill('0,25');
  await form.getByRole('button', { name: 'Agregar insumo' }).click();
  await form.getByLabel('Insumo 2', { exact: true }).selectOption({ label: milk });
  await form.getByLabel('Unidad 2', { exact: true }).selectOption('L');
  await form.getByLabel('Cantidad 2', { exact: true }).fill('0,2');
  await form.getByRole('switch', { name: 'Activo' }).check();
  await form.getByRole('button', { name: 'Crear producto' }).click();

  await expect(page).toHaveURL(/\/admin\/productos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: product })).toBeVisible();
  // Guardado en unidad base: 250 g y 200 ml (CA-07).
  await expect(page.getByLabel('Cantidad 1', { exact: true })).toHaveValue('250');
  await expect(page.getByLabel('Unidad 1', { exact: true })).toHaveValue('g');
  await expect(page.getByLabel('Cantidad 2', { exact: true })).toHaveValue('200');
  await expect(page.getByLabel('Unidad 2', { exact: true })).toHaveValue('ml');

  // Foto: el navegador la reduce a WebP y la sube con la URL firmada.
  const photo = page.getByRole('group', { name: 'Foto' });
  await photo.getByLabel('Elegir foto').setInputFiles(PHOTO);
  await expect(photo.getByRole('img', { name: 'Vista previa' })).toBeVisible();
  await photo.getByRole('button', { name: 'Guardar foto' }).click();
  await expect(page.getByText('Foto guardada')).toBeVisible();
  const saved = photo.getByRole('img', { name: `Foto de ${product}` });
  await expect(saved).toHaveAttribute('src', /\/product-images\/products\/.+\.webp$/);
  // La imagen pública carga y quedó reducida a 800 px de ancho.
  await expect
    .poll(() => saved.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBe(800);

  // En la lista: activo, con precio y miniatura.
  await page.getByRole('link', { name: '← Productos' }).click();
  await page.getByLabel('Buscar producto').fill(String(id));
  const row = page.getByRole('row', { name: new RegExp(product) });
  await expect(row).toContainText('Bs 25,50');
  await expect(row).toContainText(category);
  await expect(row.getByText('Activo')).toBeVisible();
  await expect(row.locator('img')).toHaveAttribute('src', /\.webp$/);
});

test('el menú de ejemplo del seed está en la lista', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/admin/productos');
  await expect(page.getByRole('row', { name: /Cono simple/ })).toContainText('Bs 8,00');
  await expect(
    page.getByRole('row', { name: /Malteada de chocolate/ }).getByText('Inactivo'),
  ).toBeVisible();
});

test('cajero no puede entrar a /admin/productos', async ({ page }) => {
  await loginAs(page, 'cajero');
  await page.goto('/admin/productos');
  await expect(page).toHaveURL(/\/sin-acceso$/);
});
