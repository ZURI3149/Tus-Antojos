import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

function open() {
  const api = createFakeApi();
  const result = renderApp('/admin/compras', createFakeAuth({ session: 'admin' }), api);
  return { ...result, user: userEvent.setup() };
}

describe('PurchasesPage', () => {
  it('muestra la lista de compras registradas con proveedor y monto total', async () => {
    open();
    expect(await screen.findByText('Distribuidora Láctea')).toBeVisible();
    expect(screen.getByText('Compra para apertura')).toBeVisible();
    expect(screen.getByText('Bs 18,00')).toBeVisible();
    expect(screen.getByText('2 insumos')).toBeVisible();
  });

  it('permite desplegar los detalles de las líneas de una compra', async () => {
    const { user } = open();
    expect(await screen.findByText('Distribuidora Láctea')).toBeVisible();

    const expandBtn = screen.getByRole('button', { name: /Ver detalle/i });
    await user.click(expandBtn);

    expect(screen.getByText('Líneas de la compra')).toBeVisible();
    expect(screen.getByText('Leche', { selector: 'td' })).toBeVisible();
    expect(screen.getByText('2 L', { selector: 'td' })).toBeVisible();
    expect(screen.getByText('Bs 10,00', { selector: 'td' })).toBeVisible();
    expect(screen.getByText('Bs 5,00 / L', { selector: 'td' })).toBeVisible();

    expect(screen.getByText('Azúcar', { selector: 'td' })).toBeVisible();
    expect(screen.getByText('1 kg', { selector: 'td' })).toBeVisible();
    expect(screen.getByText('Bs 8,00', { selector: 'td' })).toBeVisible();
    expect(screen.getByText('Bs 8,00 / kg', { selector: 'td' })).toBeVisible();
  });

  it('carga las compras de 50 en 50 con «Cargar más compras»', async () => {
    const api = createFakeApi();
    for (let i = 0; i < 59; i++) {
      api.inventory.data.purchases.push({
        id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        purchasedOn: '2026-11-01',
        supplier: `Proveedor ${i}`,
        note: '',
        totalCents: 100,
        createdBy: null,
        createdAt: '2026-11-01T12:00:00.000Z',
        items: [],
      });
    }
    renderApp('/admin/compras', createFakeAuth({ session: 'admin' }), api);
    const user = userEvent.setup();

    expect(await screen.findByText('Distribuidora Láctea')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /Ver detalle/i })).toHaveLength(50);

    await user.click(screen.getByRole('button', { name: 'Cargar más compras' }));
    expect(await screen.findByText('Proveedor 58')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /Ver detalle/i })).toHaveLength(60);
    expect(screen.queryByRole('button', { name: 'Cargar más compras' })).toBeNull();
  });
});
