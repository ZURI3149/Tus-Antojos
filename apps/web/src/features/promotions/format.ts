import { formatMoney, type PromotionKind, type PromotionStatus } from '@tus-antojos/shared';

export const STATUS_LABELS: Record<PromotionStatus, string> = {
  vigente: 'Vigente',
  programada: 'Programada',
  vencida: 'Vencida',
  desactivada: 'Desactivada',
};

const boliviaDateFormatter = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/La_Paz',
});

export function formatDiscount(kind: PromotionKind, value: number): string {
  if (kind === 'porcentaje') {
    return `${value} %`;
  }
  return formatMoney(value);
}

export function formatValidity(startsAt: string, endsAt: string | null): string {
  const startStr = boliviaDateFormatter.format(new Date(startsAt));
  if (!endsAt) {
    return `Desde ${startStr}`;
  }
  const endStr = boliviaDateFormatter.format(new Date(endsAt));
  return `${startStr} — ${endStr}`;
}

export function toBoliviaDatetimeLocal(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

export function fromBoliviaDatetimeLocal(str: string | null | undefined): string | null {
  if (!str) return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  if (trimmed.length === 16) return `${trimmed}:00-04:00`;
  if (trimmed.length === 19) return `${trimmed}-04:00`;
  return trimmed;
}
