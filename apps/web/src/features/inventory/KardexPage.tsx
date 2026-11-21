import {
  formatMoney,
  formatQuantity,
  formatUnitCost,
  type InventoryMovement,
  type InventoryMovementType,
} from '@tus-antojos/shared';
import { ArrowLeft, History } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useInventoryIngredient, useKardex } from './api';

const MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  compra: 'Compra',
  venta: 'Venta',
  merma: 'Merma',
  ajuste: 'Ajuste',
  anulacion: 'Anulación',
};

function MovementTypeBadge({ type }: { type: InventoryMovementType }) {
  const styles: Record<InventoryMovementType, string> = {
    compra: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    venta: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
    merma: 'bg-destructive/10 text-destructive border-destructive/20',
    ajuste: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    anulacion: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-heading font-medium tracking-wider uppercase border',
        styles[type],
      )}
    >
      {MOVEMENT_LABELS[type]}
    </span>
  );
}

export function KardexPage() {
  const { ingredientId = '' } = useParams<{ ingredientId: string }>();
  const [limit, setLimit] = useState(50);

  const ingredientQuery = useInventoryIngredient(ingredientId);
  const kardexQuery = useKardex(ingredientId, limit);

  const ingredient = ingredientQuery.data;
  const movements: InventoryMovement[] = kardexQuery.data ?? [];

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link
          to="/admin/inventario"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="size-3.5" />
          Volver a Stock e insumos
        </Link>

        <PageHeader
          eyebrow="Kardex"
          title={ingredient ? `Historial de ${ingredient.name}` : 'Historial de movimientos'}
          description={
            ingredient
              ? `Movimientos detallados, entradas, salidas y saldos en ${ingredient.unit}.`
              : 'Consultando insumo…'
          }
        />
      </div>

      {kardexQuery.isPending && <p className="text-sm text-muted-foreground">Cargando kardex…</p>}

      {kardexQuery.isError && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <span>No se pudo cargar el kardex del insumo.</span>
          <Button size="sm" variant="outline" onClick={() => kardexQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {kardexQuery.data && movements.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Este insumo aún no registra movimientos en el inventario.
        </p>
      )}

      {movements.length > 0 && ingredient && (
        <div className="flex flex-col gap-4">
          <div
            tabIndex={0}
            role="region"
            aria-label={`Kardex de ${ingredient.name}`}
            className="overflow-x-auto rounded-md border bg-card"
          >
            <table className="w-full text-sm">
              <thead className="border-b bg-secondary text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha y hora</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium text-right">Variación</th>
                  <th className="px-3 py-2 font-medium text-right">Costo mov.</th>
                  <th className="px-3 py-2 font-medium text-right">Saldo</th>
                  <th className="px-3 py-2 font-medium text-right">Costo prom. saldo</th>
                  <th className="px-3 py-2 font-medium">Motivo / Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((m) => {
                  const isPositive = m.quantity > 0;
                  const dateStr = new Date(m.createdAt).toLocaleString('es-BO', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  });

                  return (
                    <tr key={m.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2 text-muted-foreground text-xs font-mono">
                        {dateStr}
                      </td>
                      <td className="px-3 py-2">
                        <MovementTypeBadge type={m.type} />
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right font-mono font-medium',
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-destructive',
                        )}
                      >
                        {isPositive ? '+' : ''}
                        {formatQuantity(m.quantity, ingredient.unit)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {m.costCents !== 0 ? formatMoney(m.costCents) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {formatQuantity(m.balanceQuantity, ingredient.unit)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {formatUnitCost(m.balanceAvgUnitCost, ingredient.unit)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">
                        {m.reason || (m.purchaseId ? 'Compra registrada' : '-')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {movements.length >= limit && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setLimit((prev) => prev + 50)}
                className="gap-2"
              >
                <History className="size-4" />
                Cargar más movimientos
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
