import type { UseQueryResult } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

export { StatusBadge } from '@/components/status-badge';

/** Estados de carga y error de una lista del catálogo. */
export function ListState({ query, what }: { query: UseQueryResult<unknown>; what: string }) {
  if (query.isPending) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (query.isError) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <span>No se pudo cargar {what}</span>
        <Button size="sm" variant="outline" onClick={() => query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }
  return null;
}
