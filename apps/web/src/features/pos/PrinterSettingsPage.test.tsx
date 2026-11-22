import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { loadPrinterSettings } from '@/lib/escpos/printer';
import { readSimulatedPrints } from '@/lib/escpos/transports/simulated';
import { createFakeApi } from '@/test/fake-api';
import { createFakeAuth } from '@/test/fake-auth';
import { renderApp } from '@/test/render-app';

afterEach(() => {
  localStorage.clear();
});

function open(role: 'cajero' | 'cocina' = 'cajero') {
  const result = renderApp('/caja/impresora', createFakeAuth({ session: role }), createFakeApi());
  return { ...result, user: userEvent.setup() };
}

describe('/caja/impresora (OP10)', () => {
  it('muestra la configuración por defecto: navegador, 80 mm e impresión automática', async () => {
    open();

    expect(await screen.findByRole('heading', { name: 'Impresora' })).toBeVisible();
    expect(screen.getByRole('radio', { name: /Imprimir con el navegador/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /80 mm/ })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: /Imprimir automáticamente al cobrar/ }),
    ).toBeChecked();
    expect(screen.getByLabelText('Nombre del negocio')).toHaveValue('TUS ANTOJOS');
  });

  it('guarda la configuración en este dispositivo', async () => {
    const { user } = open();
    await screen.findByRole('heading', { name: 'Impresora' });

    await user.click(screen.getByRole('radio', { name: /Impresora simulada/ }));
    await user.click(screen.getByRole('radio', { name: /58 mm/ }));
    await user.click(screen.getByRole('checkbox', { name: /Imprimir automáticamente al cobrar/ }));
    await user.clear(screen.getByLabelText('Dirección'));
    await user.type(screen.getByLabelText('Dirección'), 'Av. Siempre Viva 123');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    await waitFor(() =>
      expect(loadPrinterSettings()).toMatchObject({
        transport: 'simulada',
        columns: 32,
        autoPrint: false,
        header: { address: 'Av. Siempre Viva 123' },
      }),
    );
  });

  it('el nombre del negocio es obligatorio', async () => {
    const { user } = open();
    await screen.findByRole('heading', { name: 'Impresora' });

    await user.clear(screen.getByLabelText('Nombre del negocio'));
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    expect(await screen.findByText('Escribe el nombre del negocio')).toBeVisible();
    expect(localStorage.getItem('tus-antojos:printer')).toBeNull();
  });

  it('"Ticket de prueba" imprime con lo elegido en pantalla, aunque no se haya guardado', async () => {
    const { user } = open();
    await screen.findByRole('heading', { name: 'Impresora' });

    await user.click(screen.getByRole('radio', { name: /Impresora simulada/ }));
    await user.click(screen.getByRole('radio', { name: /58 mm/ }));
    await user.click(screen.getByRole('button', { name: 'Ticket de prueba' }));

    await waitFor(() => expect(readSimulatedPrints()).toHaveLength(1));
    const [print] = readSimulatedPrints();
    expect(print?.columns).toBe(32);
    expect(print?.text.join('\n')).toContain('TICKET DE PRUEBA');
  });

  it('muestra una vista previa del ticket de prueba', async () => {
    open();

    const preview = await screen.findByLabelText('Vista previa del ticket');
    expect(preview).toHaveTextContent('TUS ANTOJOS');
    expect(preview).toHaveTextContent('No válido como factura');
  });

  it('la cocina no entra a la configuración de la impresora de caja', async () => {
    const { router } = open('cocina');

    await waitFor(() => expect(router.state.location.pathname).toBe('/sin-acceso'));
  });
});
