import { formatMoney, formatQuantity, formatUnitCost } from '@tus-antojos/shared';
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  DollarSign,
  History,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListState } from '@/features/catalog/common';
import { normalizeSearch } from '@/features/catalog/labels';
import { useStock } from './api';
import { CountDialog } from './CountDialog';
import { InventoryNav } from './InventoryNav';
import { MinStockDialog } from './MinStockDialog';
import type { StockRowData } from './reader';
import { StockStatusBadge } from './StockStatusBadge';
import { WasteDialog } from './WasteDialog';

export function StockPage() {
  const stockQuery = useStock();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  const onlyAlerts = searchParams.get('alertas') === 'true';
  const setOnlyAlerts = (active: boolean) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (active) {
        next.set('alertas', 'true');
      } else {
        next.delete('alertas');
      }
      return next;
    });
  };

  // Modals state
  const [selectedIngredient, setSelectedIngredient] = useState<StockRowData | null>(null);
  const [wasteOpen, setWasteOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const [minStockOpen, setMinStockOpen] = useState(false);

  const items = useMemo(() => stockQuery.data ?? [], [stockQuery.data]);

  // Cálculos resumen
  const stats = useMemo(() => {
    let alertCount = 0;
    let totalCents = 0;
    for (const item of items) {
      if (item.status !== 'normal') {
        alertCount += 1;
      }
      totalCents += item.totalValueCents;
    }
    return {
      totalItems: items.length,
      alertCount,
      totalValueCents: totalCents,
    };
  }, [items]);

  const visible = useMemo(() => {
    const term = normalizeSearch(search);
    return items.filter((item) => {
      if (onlyAlerts && item.status === 'normal') return false;
      if (term && !normalizeSearch(item.ingredientName).includes(term)) return false;
      return true;
    });
  }, [items, search, onlyAlerts]);

  const openWaste = (item: StockRowData) => {
    setSelectedIngredient(item);
    setWasteOpen(true);
  };

  const openCount = (item: StockRowData) => {
    setSelectedIngredient(item);
    setCountOpen(true);
  };

  const openMinStock = (item: StockRowData) => {
    setSelectedIngredient(item);
    setMinStockOpen(true);
  };

  return (
    <section className="flex flex-col gap-6">
      <InventoryNav />
      <PageHeader
        eyebrow="Inventario"
        title="Stock e insumos"
        description="Existencias en almacén, costos promedio ponderados y alertas de reposición."
      />

      {/* Tarjetas resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
            <Boxes className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-heading">
              Insumos totales
            </p>
            <p className="font-heading text-2xl font-bold">{stats.totalItems}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
          <span
            className={`flex size-11 items-center justify-center rounded-full ${
              stats.alertCount > 0
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-heading">
              En alerta
            </p>
            <p className="font-heading text-2xl font-bold">{stats.alertCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-primary">
            <DollarSign className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-heading">
              Valor del inventario
            </p>
            <p className="font-heading text-2xl font-bold">{formatMoney(stats.totalValueCents)}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <Input
          type="search"
          aria-label="Buscar insumo"
          placeholder="Buscar insumo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyAlerts}
            onChange={(e) => setOnlyAlerts(e.target.checked)}
            className="size-4 rounded border-input text-primary focus:ring-ring"
          />
          <span>Mostrar solo alertas ({stats.alertCount})</span>
        </label>
      </div>

      <ListState query={stockQuery} what="el inventario" />

      {stockQuery.data && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {search || onlyAlerts
            ? 'Ningún insumo coincide con los filtros aplicados.'
            : 'Todavía no hay insumos en el inventario.'}
        </p>
      )}

      {visible.length > 0 && (
        <div
          tabIndex={0}
          role="region"
          aria-label="Tabla de inventario y stock"
          className="overflow-x-auto rounded-md border bg-card"
        >
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Insumo</th>
                <th className="px-3 py-2 font-medium">Stock actual</th>
                <th className="px-3 py-2 font-medium">Stock mínimo</th>
                <th className="px-3 py-2 font-medium">Costo prom.</th>
                <th className="px-3 py-2 font-medium">Valor total</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium text-right">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((item) => (
                <tr key={item.ingredientId} className="hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-2 font-medium">
                    <Link
                      to={`/admin/inventario/${item.ingredientId}`}
                      className="text-primary hover:underline font-semibold"
                    >
                      {item.ingredientName}
                    </Link>
                    {!item.isActive && (
                      <span className="ml-2 text-xs text-muted-foreground">(Inactivo)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    <span
                      className={
                        item.quantity < 0
                          ? 'font-bold text-destructive'
                          : item.status === 'bajo_minimo'
                            ? 'font-bold text-amber-600 dark:text-amber-400'
                            : ''
                      }
                    >
                      {formatQuantity(item.quantity, item.unit)}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {item.minQuantity > 0
                      ? formatQuantity(item.minQuantity, item.unit)
                      : 'Sin mín.'}
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {formatUnitCost(item.avgUnitCost, item.unit)}
                  </td>
                  <td className="px-3 py-2 font-mono font-medium">
                    {item.quantity > 0 ? formatMoney(item.totalValueCents) : 'Bs 0,00'}
                  </td>
                  <td className="px-3 py-2">
                    <StockStatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openWaste(item)}
                        title="Registrar merma"
                        className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        Merma
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openCount(item)}
                        title="Conteo físico (Ajuste)"
                        className="h-8 px-2 text-xs"
                      >
                        <ClipboardCheck className="size-3.5 mr-1" />
                        Conteo
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openMinStock(item)}
                        title="Modificar stock mínimo"
                        className="h-8 px-2 text-xs"
                      >
                        <Pencil className="size-3.5 mr-1" />
                        Mínimo
                      </Button>
                      <Link
                        to={`/admin/inventario/${item.ingredientId}`}
                        className="inline-flex items-center justify-center h-8 px-2 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                        title="Ver kardex"
                      >
                        <History className="size-3.5 mr-1" />
                        Kardex
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Diálogos modales */}
      <WasteDialog
        open={wasteOpen}
        onClose={() => {
          setWasteOpen(false);
          setSelectedIngredient(null);
        }}
        ingredient={selectedIngredient}
      />

      <CountDialog
        open={countOpen}
        onClose={() => {
          setCountOpen(false);
          setSelectedIngredient(null);
        }}
        ingredient={selectedIngredient}
      />

      <MinStockDialog
        open={minStockOpen}
        onClose={() => {
          setMinStockOpen(false);
          setSelectedIngredient(null);
        }}
        ingredient={selectedIngredient}
      />
    </section>
  );
}
