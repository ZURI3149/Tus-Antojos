import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

describe('KardexPage', () => {
  it('muestra el historial de movimientos de un insumo con variaciones y saldos', async () => {
    const api = createFakeApi();
    const azucar = api.catalog.data.ingredients.find((i) => i.name === 'Azúcar')!;

    renderApp(`/admin/inventario/${azucar.id}`, createFakeAuth({ session: 'admin' }), api);

    expect(await screen.findByText('Historial de Azúcar')).toBeVisible();

    // Movimientos de Azúcar: Compra +1000g, Merma -500g
    expect(screen.getByText('Compra', { selector: 'span' })).toBeVisible();
    expect(screen.getByText('Merma', { selector: 'span' })).toBeVisible();

    expect(screen.getByText('+1 kg')).toBeVisible();
    expect(screen.getByText('-500 g')).toBeVisible();

    expect(screen.getByText('Derrame accidental')).toBeVisible();
  });
});
