import { formatMoney, formatQuantity, formatUnitCost } from '@tus-antojos/shared';
import { ChevronDown, ChevronRight, History, Plus, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ListState } from '@/features/catalog/common';
import { usePurchases } from './api';
import { InventoryNav } from './InventoryNav';
import type { PurchaseRowData } from './reader';

function PurchaseRow({ purchase }: { purchase: PurchaseRowData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="hover:bg-muted/40 transition-colors">
        <td className="px-3 py-2 w-10">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(!expanded)}
            className="size-7"
            aria-label={expanded ? 'Ocultar detalle' : 'Ver detalle'}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>
        </td>
        <td className="px-3 py-2 font-mono text-sm font-medium">{purchase.purchasedOn}</td>
        <td className="px-3 py-2 text-sm">
          {purchase.supplier || <span className="text-muted-foreground italic">Sin proveedor</span>}
        </td>
        <td className="px-3 py-2 text-sm text-muted-foreground max-w-xs truncate">
          {purchase.note || '-'}
        </td>
        <td className="px-3 py-2 text-sm text-center">
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-mono">
            {purchase.items.length} {purchase.items.length === 1 ? 'insumo' : 'insumos'}
          </span>
        </td>
        <td className="px-3 py-2 font-mono text-sm font-semibold text-right">
          {formatMoney(purchase.totalCents)}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="p-4">
            <div className="rounded-md border bg-card p-3 shadow-xs">
              <h4 className="font-heading text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Líneas de la compra
              </h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-1 font-medium">Insumo</th>
                    <th className="pb-1 font-medium text-right">Cantidad</th>
                    <th className="pb-1 font-medium text-right">Costo línea</th>
                    <th className="pb-1 font-medium text-right">Costo unitario eq.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {purchase.items.map((item, idx) => {
                    const unitCost =
                      item.quantity > 0 ? (item.costCents / item.quantity).toFixed(6) : '0';
                    return (
                      <tr key={`${item.ingredientId}-${idx}`}>
                        <td className="py-1.5 font-medium">{item.ingredientName}</td>
                        <td className="py-1.5 font-mono text-right">
                          {formatQuantity(item.quantity, item.unit)}
                        </td>
                        <td className="py-1.5 font-mono text-right font-medium">
                          {formatMoney(item.costCents)}
                        </td>
                        <td className="py-1.5 font-mono text-right text-muted-foreground">
                          {formatUnitCost(unitCost, item.unit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const PAGE_SIZE = 50;

export function PurchasesPage() {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const purchasesQuery = usePurchases(limit);
  const purchases = purchasesQuery.data ?? [];

  return (
    <section className="flex flex-col gap-6">
      <InventoryNav />
      <PageHeader
        eyebrow="Inventario"
        title="Compras"
        description="Historial de compras de insumos para reabastecimiento del almacén."
        actions={
          <Button asChild>
            <Link to="/admin/compras/nueva" className="gap-2">
              <Plus className="size-4" />
              Nueva compra
            </Link>
          </Button>
        }
      />

      <ListState query={purchasesQuery} what="las compras" />

      {purchasesQuery.data && purchases.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <ShoppingBag className="size-10 mb-2 stroke-1" />
          <p className="font-heading text-base font-medium">No hay compras registradas</p>
          <p className="text-sm mt-1 max-w-sm">
            Registra una nueva compra para ingresar existencias y actualizar los costos promedio.
          </p>
          <Button asChild className="mt-4">
            <Link to="/admin/compras/nueva">Registrar primera compra</Link>
          </Button>
        </div>
      )}

      {purchases.length > 0 && (
        <div
          tabIndex={0}
          role="region"
          aria-label="Listado de compras registradas"
          className="overflow-x-auto rounded-md border bg-card"
        >
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary text-left">
              <tr>
                <th className="px-3 py-2 w-10">
                  <span className="sr-only">Desplegar</span>
                </th>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Proveedor</th>
                <th className="px-3 py-2 font-medium">Nota / Factura</th>
                <th className="px-3 py-2 font-medium text-center">Líneas</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {purchases.map((purchase) => (
                <PurchaseRow key={purchase.id} purchase={purchase} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {purchases.length >= limit && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
            disabled={purchasesQuery.isFetching}
            className="gap-2"
          >
            <History className="size-4" />
            Cargar más compras
          </Button>
        </div>
      )}
    </section>
  );
}
