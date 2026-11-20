import { formatMoney } from '@tus-antojos/shared';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { selectClassName } from '@/lib/utils';
import { CatalogNav } from './CatalogNav';
import { useCategories, useProducts } from './api';
import { ListState, StatusBadge } from './common';
import { normalizeSearch } from './labels';

type StatusFilter = 'all' | 'active' | 'inactive';

export function ProductsPage() {
  const products = useProducts();
  const categories = useCategories();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const categoryName = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data],
  );

  const visible = useMemo(() => {
    const term = normalizeSearch(search);
    return (products.data ?? []).filter(
      (p) =>
        normalizeSearch(p.name).includes(term) &&
        (!categoryId || p.categoryId === categoryId) &&
        (status === 'all' || p.isActive === (status === 'active')),
    );
  }, [products.data, search, categoryId, status]);

  const filtering = search !== '' || categoryId !== '' || status !== 'all';

  return (
    <section className="flex flex-col gap-4">
      <CatalogNav />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <Button asChild>
          <Link to="/admin/productos/nuevo">Nuevo producto</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          aria-label="Buscar producto"
          placeholder="Buscar producto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          aria-label="Categoría"
          className={`${selectClassName} w-auto`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Estado"
          className={`${selectClassName} w-auto`}
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      <ListState query={products} what="los productos" />
      {products.data && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {filtering ? 'Ningún producto coincide con los filtros.' : 'Todavía no hay productos.'}
        </p>
      )}
      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Categoría</th>
                <th className="px-3 py-2 text-right font-medium">Precio</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{product.name}</td>
                  <td className="px-3 py-2">{categoryName.get(product.categoryId) ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(product.priceCents)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge active={product.isActive} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={`/admin/productos/${product.id}`}
                        aria-label={`Editar ${product.name}`}
                      >
                        Editar
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
