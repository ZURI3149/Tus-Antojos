import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

describe('InventoryAlerts', () => {
  it('muestra las alertas cuando hay insumos bajo su stock mínimo', async () => {
    const api = createFakeApi();
    renderApp('/admin', createFakeAuth({ session: 'admin' }), api);

    // Azúcar está con 500 g y mínimo 1000 g -> alerta
    expect(await screen.findByText(/Alertas de inventario \(1\)/i)).toBeVisible();
    expect(screen.getByText('Azúcar')).toBeVisible();
    expect(screen.getByText('Bajo mínimo')).toBeVisible();
  });

  it('muestra estado óptimo cuando todos los insumos tienen stock suficiente', async () => {
    const api = createFakeApi();
    // Ajustamos azúcar para que esté por encima de su mínimo
    const azucar = api.catalog.data.ingredients.find((i) => i.name === 'Azúcar')!;
    const azucarStock = api.inventory.data.stock.get(azucar.id)!;
    azucarStock.quantity = 1500;

    renderApp('/admin', createFakeAuth({ session: 'admin' }), api);

    expect(await screen.findByText('Inventario en niveles óptimos')).toBeVisible();
  });
});
