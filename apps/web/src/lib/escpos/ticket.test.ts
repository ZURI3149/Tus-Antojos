import type { Order } from '@tus-antojos/shared';
import { describe, expect, it } from 'vitest';
import type { OutboxEntry } from '@/lib/offline/types';
import {
  DEFAULT_TICKET_CONFIG,
  encodeTicket,
  layoutTicket,
  renderTicketText,
  ticketFromOrder,
  ticketFromOutboxEntry,
  type TicketConfig,
  type TicketData,
} from './ticket';

/** Línea de dos columnas como la arma la impresora: izquierda, espacios, derecha. */
function lr(left: string, right: string, columns = 48): string {
  return left + ' '.repeat(columns - left.length - right.length) + right;
}
function center(text: string, columns = 48): string {
  return ' '.repeat(Math.floor((columns - text.length) / 2)) + text;
}

const config: TicketConfig = {
  ...DEFAULT_TICKET_CONFIG,
  header: { businessName: 'TUS ANTOJOS', address: 'Av. Siempre Viva 123', taxId: '1234567' },
};

const sale: TicketData = {
  orderLabel: '#12',
  // 18:35 UTC = 14:35 en Bolivia
  createdAt: '2026-11-22T18:35:00.000Z',
  cashierName: 'Cajero de Prueba',
  lines: [
    {
      name: 'Cono de frutilla',
      quantity: 2,
      unitPriceCents: 1000,
      promotionName: 'Verano 20%',
      unitDiscountCents: 200,
      lineTotalCents: 1600,
      note: '',
    },
    {
      name: 'Copa de chocolate',
      quantity: 1,
      unitPriceCents: 1800,
      promotionName: null,
      unitDiscountCents: 0,
      lineTotalCents: 1800,
      note: 'Sin crema',
    },
    {
      name: 'Gaseosa',
      quantity: 1,
      unitPriceCents: 700,
      promotionName: null,
      unitDiscountCents: 0,
      lineTotalCents: 700,
      note: '',
    },
  ],
  subtotalCents: 4500,
  discountCents: 400,
  totalCents: 4100,
  paymentMethod: 'efectivo',
  cashReceivedCents: 5000,
  changeCents: 900,
  offline: false,
  reprint: false,
};

describe('renderTicketText (80 mm)', () => {
  it('ticket de 3 productos con promoción, pago en efectivo y vuelto', () => {
    expect(renderTicketText(sale, config)).toEqual([
      center('TUS ANTOJOS'),
      center('Av. Siempre Viva 123'),
      center('NIT 1234567'),
      '-'.repeat(48),
      center('PEDIDO #12'),
      '22/11/2026 14:35',
      'Cajero: Cajero de Prueba',
      '-'.repeat(48),
      lr('2 x Cono de frutilla', 'Bs 20,00'),
      lr('    Verano 20%', '-Bs 4,00'),
      lr('1 x Copa de chocolate', 'Bs 18,00'),
      '    Nota: Sin crema',
      lr('1 x Gaseosa', 'Bs 7,00'),
      '-'.repeat(48),
      lr('Subtotal', 'Bs 45,00'),
      lr('Descuentos', '-Bs 4,00'),
      lr('TOTAL', 'Bs 41,00'),
      lr('Pago', 'Efectivo'),
      lr('Recibido', 'Bs 50,00'),
      lr('Cambio', 'Bs 9,00'),
      '-'.repeat(48),
      center('Gracias por su compra'),
      center('No válido como factura'),
    ]);
  });

  it('sin descuentos no muestra la línea de descuentos', () => {
    const text = renderTicketText(
      { ...sale, lines: [sale.lines[2]!], subtotalCents: 700, discountCents: 0, totalCents: 700 },
      config,
    );
    expect(text.some((l) => l.startsWith('Descuentos'))).toBe(false);
  });

  it('pago QR: sin recibido ni cambio', () => {
    const text = renderTicketText(
      { ...sale, paymentMethod: 'qr', cashReceivedCents: null, changeCents: null },
      config,
    );
    expect(text).toContain(lr('Pago', 'QR'));
    expect(text.some((l) => l.startsWith('Recibido') || l.startsWith('Cambio'))).toBe(false);
  });

  it('pedido offline: número provisional y leyenda de sincronización', () => {
    const text = renderTicketText({ ...sale, orderLabel: 'OFF-AB12', offline: true }, config);
    expect(text).toContain(center('PEDIDO OFF-AB12'));
    expect(text).toContain(center('PENDIENTE DE SINCRONIZAR'));
  });

  it('reimpresión: lleva la leyenda REIMPRESIÓN', () => {
    expect(renderTicketText({ ...sale, reprint: true }, config)).toContain(center('REIMPRESIÓN'));
  });

  it('sin dirección ni NIT el encabezado es solo el nombre', () => {
    const text = renderTicketText(sale, {
      ...config,
      header: { businessName: 'TUS ANTOJOS' },
    });
    expect(text.slice(0, 2)).toEqual([center('TUS ANTOJOS'), '-'.repeat(48)]);
  });
});

describe('renderTicketText: líneas largas', () => {
  const long: TicketData = {
    ...sale,
    lines: [
      {
        name: 'Copa gigante de helado de chocolate con frutillas y crema batida',
        quantity: 12,
        unitPriceCents: 4550,
        promotionName: null,
        unitDiscountCents: 0,
        lineTotalCents: 54600,
        note: 'Por favor con mucha crema y sin nueces porque el cliente es alérgico',
      },
    ],
  };

  it.each([48, 32] as const)('a %i columnas ninguna línea se pasa del ancho', (columns) => {
    const text = renderTicketText(long, { ...config, columns });
    for (const line of text) expect(line.length).toBeLessThanOrEqual(columns);
  });

  it('el nombre largo sigue en la línea siguiente sin perder el precio', () => {
    const text = renderTicketText(long, { ...config, columns: 32 });
    const first = text.findIndex((l) => l.startsWith('12 x Copa'));
    expect(text[first]).toMatch(/Bs 546,00$/);
    expect(text[first + 1]).toMatch(/^ {4}\S/);
    expect(text.join(' ')).toContain('crema batida');
    expect(text.join(' ')).toContain('alérgico');
  });
});

describe('encodeTicket', () => {
  it('empieza inicializando la impresora y termina cortando el papel', () => {
    const bytes = [...encodeTicket(layoutTicket(sale, config), config)];
    expect(bytes.slice(0, 2)).toEqual([0x1b, 0x40]);
    expect(bytes.slice(-3)).toEqual([0x1d, 0x56, 1]);
  });

  it('con transliteración no hay bytes fuera de ASCII', () => {
    const ascii = { ...config, transliterate: true };
    const bytes = encodeTicket(layoutTicket({ ...sale, reprint: true }, ascii), ascii);
    expect([...bytes].every((b) => b < 0x80)).toBe(true);
  });
});

describe('ticketFromOrder', () => {
  const order: Order = {
    id: 'o1',
    clientOrderId: 'c1',
    businessDate: '2026-11-22',
    orderNumber: 12,
    status: 'pendiente',
    paymentMethod: 'efectivo',
    subtotalCents: 2000,
    discountCents: 400,
    totalCents: 1600,
    cashierId: 'u1',
    cashierName: 'Cajero de Prueba',
    createdOfflineAt: null,
    cancelReason: null,
    createdAt: '2026-11-22T18:35:00.000Z',
    updatedAt: '2026-11-22T18:35:00.000Z',
    items: [
      {
        lineNo: 1,
        productId: 'p1',
        productName: 'Cono de frutilla',
        quantity: 2,
        unitPriceCents: 1000,
        promotionId: 'pr1',
        promotionName: 'Verano 20%',
        unitDiscountCents: 200,
        lineTotalCents: 1600,
        note: '',
      },
    ],
  };

  it('usa el número del día, los totales del servidor y lo recibido si se pasa', () => {
    expect(
      ticketFromOrder(order, { reprint: true, cashReceivedCents: 2000, changeCents: 400 }),
    ).toMatchObject({
      orderLabel: '#12',
      cashierName: 'Cajero de Prueba',
      totalCents: 1600,
      cashReceivedCents: 2000,
      changeCents: 400,
      offline: false,
      reprint: true,
      lines: [{ name: 'Cono de frutilla', quantity: 2, promotionName: 'Verano 20%' }],
    });
  });
});

describe('ticketFromOutboxEntry', () => {
  it('usa el número provisional, lo cobrado y la hora de la venta', () => {
    const entry = {
      clientOrderId: '7f1e2d3c-0000-4000-a000-00000000ab12',
      body: {
        clientOrderId: '7f1e2d3c-0000-4000-a000-00000000ab12',
        items: [],
        paymentMethod: 'efectivo',
        createdOfflineAt: '2026-11-22T18:00:00.000Z',
      },
      cashierName: 'Cajero de Prueba',
      enqueuedAt: '2026-11-22T18:00:01.000Z',
      charged: {
        lines: [
          {
            productId: 'p1',
            productName: 'Gaseosa',
            quantity: 1,
            unitPriceCents: 700,
            promotionId: null,
            promotionName: null,
            unitDiscountCents: 0,
            lineTotalCents: 700,
            note: '',
          },
        ],
        subtotalCents: 700,
        discountCents: 0,
        totalCents: 700,
        cashReceivedCents: 1000,
        changeCents: 300,
      },
    } as unknown as OutboxEntry;

    expect(ticketFromOutboxEntry(entry)).toMatchObject({
      orderLabel: 'OFF-AB12',
      createdAt: '2026-11-22T18:00:00.000Z',
      offline: true,
      reprint: false,
      totalCents: 700,
      changeCents: 300,
      lines: [{ name: 'Gaseosa', quantity: 1 }],
    });
  });
});
