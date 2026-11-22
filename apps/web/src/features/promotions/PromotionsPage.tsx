import { promotionStatus, type PromotionStatus } from '@tus-antojos/shared';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { selectClassName } from '@/lib/utils';
import { notifyPromotionError, usePromotions, useUpdatePromotion } from './api';
import { formatDiscount, formatValidity } from './format';
import { PromotionStatusBadge } from './PromotionStatusBadge';
import type { PromotionRowData } from './reader';

type StatusFilter = 'all' | PromotionStatus;

export function PromotionsPage() {
  const promotions = usePromotions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (promotions.data ?? []).filter((p) => {
      const matchesSearch = term === '' || p.name.toLowerCase().includes(term);
      const status = promotionStatus(p);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [promotions.data, search, statusFilter]);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Promociones"
        description="Descuentos por porcentaje o monto fijo sobre productos."
        actions={
          <Button asChild>
            <Link to="/admin/promociones/nueva">Nueva promoción</Link>
          </Button>
        }
      />

      <div className="grid gap-2 rounded-md bg-secondary p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          type="search"
          aria-label="Buscar promoción"
          placeholder="Buscar promoción…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
        <select
          aria-label="Estado"
          className={`${selectClassName} w-auto`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">Todos los estados</option>
          <option value="vigente">Vigentes</option>
          <option value="programada">Programadas</option>
          <option value="vencida">Vencidas</option>
          <option value="desactivada">Desactivadas</option>
        </select>
      </div>

      {promotions.isLoading && (
        <p className="text-sm text-muted-foreground">Cargando promociones…</p>
      )}

      {promotions.isError && (
        <p className="text-sm text-destructive">Error al cargar las promociones.</p>
      )}

      {promotions.data && promotions.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no hay promociones.</p>
      )}

      {promotions.data && promotions.data.length > 0 && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay promociones que coincidan con los filtros aplicados.
        </p>
      )}

      {visible.length > 0 && (
        <div className="relative overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Descuento</th>
                <th className="px-3 py-2 font-medium">Vigencia</th>
                <th className="px-3 py-2 font-medium">Productos</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium text-right">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((promo) => (
                <PromotionRow key={promo.id} promo={promo} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PromotionRow({ promo }: { promo: PromotionRowData }) {
  const update = useUpdatePromotion();
  const status = promotionStatus(promo);

  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-medium">{promo.name}</td>
      <td className="px-3 py-2 tabular-nums">{formatDiscount(promo.kind, promo.value)}</td>
      <td className="px-3 py-2 text-muted-foreground">
        {formatValidity(promo.startsAt, promo.endsAt)}
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {promo.productCount} {promo.productCount === 1 ? 'producto' : 'productos'}
      </td>
      <td className="px-3 py-2">
        <PromotionStatusBadge status={status} />
      </td>
      <td className="flex justify-end gap-2 px-3 py-2">
        <Button size="sm" variant="outline" asChild>
          <Link to={`/admin/promociones/${promo.id}`}>Editar</Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label={`${promo.isActive ? 'Desactivar' : 'Activar'} ${promo.name}`}
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { id: promo.id, changes: { isActive: !promo.isActive } },
              { onError: notifyPromotionError },
            )
          }
        >
          {promo.isActive ? 'Desactivar' : 'Activar'}
        </Button>
      </td>
    </tr>
  );
}
