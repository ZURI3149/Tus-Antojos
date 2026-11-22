import type { PromotionStatus } from '@tus-antojos/shared';
import { cn } from '@/lib/utils';

export function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  if (status === 'vigente') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-heading text-[0.7rem] tracking-wider uppercase',
          'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
        Vigente
      </span>
    );
  }

  if (status === 'programada') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-heading text-[0.7rem] tracking-wider uppercase',
          'border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-sky-500" />
        Programada
      </span>
    );
  }

  if (status === 'vencida') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-heading text-[0.7rem] tracking-wider uppercase',
          'border border-muted-foreground/30 bg-muted text-muted-foreground',
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/50" />
        Vencida
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-heading text-[0.7rem] tracking-wider uppercase',
        'border border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
      Desactivada
    </span>
  );
}
