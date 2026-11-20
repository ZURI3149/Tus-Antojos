import { cn } from '@/lib/utils';

/** Etiqueta Activo / Inactivo. */
export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-heading text-[0.7rem] tracking-wider uppercase',
        active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground',
      )}
    >
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full', active ? 'bg-gold' : 'bg-muted-foreground/50')}
      />
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}
