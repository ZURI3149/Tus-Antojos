import type { UseQueryResult } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Etiqueta Activo / Inactivo. */
export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 text-xs',
        active ? 'bg-secondary' : 'bg-destructive/10 text-destructive',
      )}
    >
      {active ? 'Activo' : 'Inactivo'}
    </span>
  );
}

/** Estados de carga y error de una lista del catálogo. */
export function ListState({ query, what }: { query: UseQueryResult<unknown>; what: string }) {
  if (query.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (query.isError) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/40 p-3 text-sm">
        <span>No se pudo cargar {what}</span>
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }
  return null;
}
