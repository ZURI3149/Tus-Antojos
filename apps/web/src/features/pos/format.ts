import type { OrderStatus } from '@tus-antojos/shared';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  anulado: 'Anulado',
};

export function toBoliviaDate(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function formatOrderTime(isoString: string): string {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}
