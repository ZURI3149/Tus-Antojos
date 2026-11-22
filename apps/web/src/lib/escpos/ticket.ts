import { formatMoney, type Order, type PaymentMethod } from '@tus-antojos/shared';
import { provisionalOrderLabel } from '@/lib/offline/labels';
import type { OutboxEntry } from '@/lib/offline/types';
import { createEncoder, type PaperColumns } from './encoder';

/** Una línea vendida, tal como se cobró. */
export interface TicketLine {
  name: string;
  quantity: number;
  unitPriceCents: number;
  promotionName: string | null;
  unitDiscountCents: number;
  lineTotalCents: number;
  note: string;
}

/** Todo lo que lleva un ticket (SPEC-offline-print OP-D15), sin saber de dónde vino. */
export interface TicketData {
  /** `#12` (número del día) u `OFF-XXXX` (pedido aún en la cola). */
  orderLabel: string;
  /** Momento de la venta, ISO 8601. */
  createdAt: string;
  cashierName: string | null;
  lines: TicketLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod;
  cashReceivedCents: number | null;
  changeCents: number | null;
  offline: boolean;
  reprint: boolean;
}

export interface TicketConfig {
  columns: PaperColumns;
  transliterate: boolean;
  header: { businessName: string; address?: string; taxId?: string };
  footer: string;
}

export const DEFAULT_TICKET_CONFIG: TicketConfig = {
  columns: 48,
  transliterate: false,
  header: { businessName: 'TUS ANTOJOS' },
  footer: 'Gracias por su compra',
};

/** Instrucciones de diseño del ticket: se convierten en bytes ESC/POS o en texto plano. */
export type TicketOp =
  | {
      kind: 'text';
      text: string;
      align?: 'left' | 'center';
      bold?: boolean;
      size?: { width: 1 | 2; height: 1 | 2 };
    }
  | { kind: 'line'; left: string; right: string; bold?: boolean }
  | { kind: 'rule' };

const INDENT = '    ';

/** Parte un texto en renglones de hasta `width` caracteres, cortando palabras solo si no entran. */
export function wrapText(text: string, width: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (let word of words) {
    while (word.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (!current) current = word;
    else if (current.length + 1 + word.length <= width) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatTicketDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

function centered(
  text: string,
  columns: number,
  extra: { bold?: boolean; size?: { width: 1 | 2; height: 1 | 2 } } = {},
): TicketOp[] {
  // En doble ancho cada carácter ocupa dos columnas del papel.
  const width = extra.size?.width === 2 ? Math.floor(columns / 2) : columns;
  return wrapText(text, width).map((t) => ({ kind: 'text', text: t, align: 'center', ...extra }));
}

/** Línea de producto con su precio; si el nombre no entra, sigue en renglones con sangría. */
function itemOps(line: TicketLine, columns: number): TicketOp[] {
  const price = formatMoney(line.quantity * line.unitPriceCents);
  const left = `${line.quantity} x ${line.name}`;
  const [first = '', ...rest] = wrapText(left, columns - price.length - 1);
  const ops: TicketOp[] = [{ kind: 'line', left: first, right: price }];
  const remaining = rest.join(' ');
  for (const t of wrapText(remaining, columns - INDENT.length)) {
    ops.push({ kind: 'text', text: INDENT + t });
  }
  if (line.promotionName && line.unitDiscountCents > 0) {
    ops.push({
      kind: 'line',
      left: INDENT + line.promotionName,
      right: formatMoney(-line.quantity * line.unitDiscountCents),
    });
  }
  if (line.note.trim()) {
    for (const t of wrapText(`Nota: ${line.note}`, columns - INDENT.length)) {
      ops.push({ kind: 'text', text: INDENT + t });
    }
  }
  return ops;
}

/** Diseño del ticket de un pedido (SPEC-offline-print OP-D15). */
export function layoutTicket(data: TicketData, config: TicketConfig): TicketOp[] {
  const { columns, header } = config;
  const ops: TicketOp[] = [
    ...centered(header.businessName, columns, { bold: true, size: { width: 1, height: 2 } }),
  ];
  if (header.address) ops.push(...centered(header.address, columns));
  if (header.taxId) ops.push(...centered(`NIT ${header.taxId}`, columns));
  ops.push({ kind: 'rule' });

  ops.push(
    ...centered(`PEDIDO ${data.orderLabel}`, columns, {
      bold: true,
      size: { width: 2, height: 2 },
    }),
  );
  if (data.offline) ops.push(...centered('PENDIENTE DE SINCRONIZAR', columns, { bold: true }));
  if (data.reprint) ops.push(...centered('REIMPRESIÓN', columns, { bold: true }));
  ops.push({ kind: 'text', text: formatTicketDate(data.createdAt) });
  if (data.cashierName) {
    for (const t of wrapText(`Cajero: ${data.cashierName}`, columns)) {
      ops.push({ kind: 'text', text: t });
    }
  }
  ops.push({ kind: 'rule' });

  for (const line of data.lines) ops.push(...itemOps(line, columns));
  ops.push({ kind: 'rule' });

  ops.push({ kind: 'line', left: 'Subtotal', right: formatMoney(data.subtotalCents) });
  if (data.discountCents > 0) {
    ops.push({ kind: 'line', left: 'Descuentos', right: formatMoney(-data.discountCents) });
  }
  ops.push({ kind: 'line', left: 'TOTAL', right: formatMoney(data.totalCents), bold: true });
  ops.push({
    kind: 'line',
    left: 'Pago',
    right: data.paymentMethod === 'qr' ? 'QR' : 'Efectivo',
  });
  if (data.paymentMethod === 'efectivo' && data.cashReceivedCents !== null) {
    ops.push({ kind: 'line', left: 'Recibido', right: formatMoney(data.cashReceivedCents) });
    ops.push({ kind: 'line', left: 'Cambio', right: formatMoney(data.changeCents ?? 0) });
  }
  ops.push({ kind: 'rule' });

  ops.push(...centered(config.footer, columns));
  ops.push(...centered('No válido como factura', columns));
  return ops;
}

/** Bytes ESC/POS: inicializa, imprime el diseño, avanza el papel y corta. */
export function encodeTicket(
  ops: TicketOp[],
  config: Pick<TicketConfig, 'columns' | 'transliterate'>,
): Uint8Array {
  const enc = createEncoder({
    columns: config.columns,
    transliterate: config.transliterate,
  }).init();
  for (const op of ops) {
    if (op.kind === 'rule') enc.rule();
    else if (op.kind === 'line') {
      if (op.bold) enc.bold(true);
      enc.line(op.left, op.right);
      if (op.bold) enc.bold(false);
    } else {
      enc.align(op.align ?? 'left');
      if (op.bold) enc.bold(true);
      if (op.size) enc.size(op.size);
      enc.text(op.text);
      if (op.size) enc.size();
      if (op.bold) enc.bold(false);
    }
  }
  return enc.align('left').feed(3).cut().encode();
}

/** El mismo diseño como renglones de texto (plantilla del navegador, vista previa, pruebas). */
export function opsToText(ops: TicketOp[], columns: number): string[] {
  return ops.map((op) => {
    if (op.kind === 'rule') return '-'.repeat(columns);
    if (op.kind === 'line') {
      const right = op.right.slice(0, columns);
      const left = op.left.slice(0, Math.max(0, columns - right.length - 1));
      return left + ' '.repeat(columns - left.length - right.length) + right;
    }
    const text = op.text.slice(0, columns);
    return op.align === 'center'
      ? ' '.repeat(Math.floor((columns - text.length) / 2)) + text
      : text;
  });
}

export function renderTicketText(data: TicketData, config: TicketConfig): string[] {
  return opsToText(layoutTicket(data, config), config.columns);
}

/** Ticket de un pedido que ya devolvió la API (al cobrar en línea o al reimprimir). */
export function ticketFromOrder(
  order: Order,
  opts: { reprint?: boolean; cashReceivedCents?: number | null; changeCents?: number | null } = {},
): TicketData {
  return {
    orderLabel: `#${order.orderNumber}`,
    createdAt: order.createdOfflineAt ?? order.createdAt,
    cashierName: order.cashierName ?? null,
    lines: (order.items ?? []).map((i) => ({
      name: i.productName,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      promotionName: i.promotionName,
      unitDiscountCents: i.unitDiscountCents,
      lineTotalCents: i.lineTotalCents,
      note: i.note,
    })),
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    paymentMethod: order.paymentMethod,
    cashReceivedCents: opts.cashReceivedCents ?? null,
    changeCents: opts.changeCents ?? null,
    offline: false,
    reprint: opts.reprint ?? false,
  };
}

/** Ticket de un pedido que quedó en la cola: lo que vio y cobró el cajero. */
export function ticketFromOutboxEntry(
  entry: OutboxEntry,
  opts: { reprint?: boolean } = {},
): TicketData {
  return {
    orderLabel: provisionalOrderLabel(entry.clientOrderId),
    createdAt: entry.body.createdOfflineAt ?? entry.enqueuedAt,
    cashierName: entry.cashierName || null,
    lines: entry.charged.lines.map((l) => ({
      name: l.productName,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      promotionName: l.promotionName,
      unitDiscountCents: l.unitDiscountCents,
      lineTotalCents: l.lineTotalCents,
      note: l.note,
    })),
    subtotalCents: entry.charged.subtotalCents,
    discountCents: entry.charged.discountCents,
    totalCents: entry.charged.totalCents,
    paymentMethod: entry.body.paymentMethod,
    cashReceivedCents: entry.charged.cashReceivedCents,
    changeCents: entry.charged.changeCents,
    offline: true,
    reprint: opts.reprint ?? false,
  };
}
