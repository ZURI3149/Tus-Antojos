import type { StockStatus } from '@tus-antojos/shared';
import { cn } from '@/lib/utils';

export function StockStatusBadge({ status }: { status: StockStatus }) {
  if (status === 'negativo') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-heading text-[0.7rem] tracking-wider uppercase',
          'border border-destructive/30 bg-destructive/10 text-destructive',
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-destructive animate-pulse" />
        Negativo
      </span>
    );
  }

  if (status === 'bajo_minimo') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-heading text-[0.7rem] tracking-wider uppercase',
          'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
        Bajo mínimo
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-heading text-[0.7rem] tracking-wider uppercase',
        'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
      Normal
    </span>
  );
}
