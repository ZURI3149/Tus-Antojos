import { expect, test, type Page } from '@playwright/test';
import { cancelOrdersByClientId, serviceClient } from './orders-cleanup';
import { loginAs } from './support';

/** Texto de los tickets que guardó la impresora simulada en la página. */
function printedTickets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const prints = (window as unknown as { __tusAntojosPrints?: { text: string[] }[] })
      .__tusAntojosPrints;
    return (prints ?? []).map((p) => p.text.join('\n'));
  });
}

test.describe('ticket impreso al cobrar', () => {
  let createdNumber: number | null = null;

  test.afterEach(async () => {
    if (createdNumber === null) return;
    const { data } = await serviceClient()
      .from('orders')
      .select('client_order_id')
      .eq('order_number', createdNumber)
      .order('created_at', { ascending: false })
      .limit(1);
    await cancelOrdersByClientId((data ?? []).map((o) => o.client_order_id));
    createdNumber = null;
  });

  test('CE-01: venta en efectivo de 3 productos con ticket en menos de 30 s', async ({ page }) => {
    // Preparación (no cuenta para CE-01): elegir la impresora simulada en esta caja.
    await loginAs(page, 'cajero');
    await page.getByRole('link', { name: 'Impresora' }).click();
    await page.getByRole('radio', { name: /Impresora simulada/ }).check();
    await page.getByRole('button', { name: 'Guardar configuración' }).click();
    await page.getByRole('link', { name: 'Nueva venta' }).click();
    await expect(
      page.getByRole('button', { name: /Agregar Cono simple al pedido/i }),
    ).toBeVisible();

    // La venta: 3 productos, efectivo con billete de Bs 50, ticket impreso.
    const start = Date.now();
    for (const product of ['Cono simple', 'Cono de frutilla', 'Copa de chocolate']) {
      await page
        .getByRole('button', { name: new RegExp(`Agregar ${product} al pedido`, 'i') })
        .click();
    }
    await page
      .getByLabel('Carrito de pedido actual')
      .getByRole('button', { name: /Cobrar/i })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Bs 50' }).click();
    await dialog.getByRole('button', { name: 'Confirmar y Entregar' }).click();

    await expect.poll(() => printedTickets(page)).toHaveLength(1);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(30_000);

    const [ticket] = await printedTickets(page);
    const number = Number(ticket!.match(/PEDIDO #(\d+)/)?.[1]);
    createdNumber = Number.isFinite(number) ? number : null;
    expect(ticket).toMatch(/PEDIDO #\d+/);
    expect(ticket).toMatch(/1 x Cono simple/);
    expect(ticket).toMatch(/1 x Cono de frutilla/);
    expect(ticket).toMatch(/1 x Copa de chocolate/);
    expect(ticket).toMatch(/TOTAL\s+Bs \d+,\d{2}/);
    expect(ticket).toMatch(/Recibido\s+Bs 50,00/);
    expect(ticket).toMatch(/Cambio\s+Bs \d+,\d{2}/);
    expect(ticket).toContain('No válido como factura');

    // Reimprimir desde los pedidos del día.
    await page.getByRole('link', { name: 'Pedidos del día' }).click();
    await page.getByRole('button', { name: `Reimprimir pedido #${createdNumber}` }).click();
    await expect.poll(() => printedTickets(page)).toHaveLength(2);
    expect((await printedTickets(page))[1]).toContain('REIMPRESIÓN');
  });
});
