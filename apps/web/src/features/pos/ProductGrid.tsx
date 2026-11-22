import { useMemo, useState } from 'react';
import { Search, ShoppingBag, Tag, X } from 'lucide-react';
import {
  bestPromotion,
  formatMoney,
  type Category,
  type Product,
} from '@tus-antojos/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProductImageStorage } from '@/features/catalog/images';
import type { PromotionRowData } from '@/features/promotions/reader';
import { cn } from '@/lib/utils';

export interface ProductGridProps {
  products: Product[];
  categories: Category[];
  promotions: PromotionRowData[];
  cartQuantities: Map<string, number>;
  onAddToCart: (productId: string) => void;
  isLoading?: boolean;
}

export function ProductGrid({
  products,
  categories,
  promotions,
  cartQuantities,
  onAddToCart,
  isLoading = false,
}: ProductGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const imageStorage = useProductImageStorage();

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive),
    [categories],
  );

  const activePromos = useMemo(
    () => promotions.filter((p) => p.isActive),
    [promotions],
  );

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => p.isActive)
      .filter((p) => {
        if (!selectedCategory) return true;
        return p.categoryId === selectedCategory;
      })
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
        );
      });
  }, [products, selectedCategory, searchQuery]);

  return (
    <section aria-label="Catálogo de productos" className="flex flex-col gap-4">
      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="pos-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar producto por nombre..."
            aria-label="Buscar producto"
            className="pl-9 pr-9 min-h-[48px] text-base"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Pestañas de categorías con touch target accesible */}
        <div
          role="tablist"
          aria-label="Categorías de productos"
          className="flex flex-wrap gap-2 pb-1"
        >
          <Button
            type="button"
            role="tab"
            aria-selected={selectedCategory === null}
            variant={selectedCategory === null ? 'default' : 'outline'}
            onClick={() => setSelectedCategory(null)}
            className="min-h-[44px] px-4 font-heading text-xs tracking-wide uppercase"
          >
            Todos
          </Button>
          {activeCategories.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(cat.id)}
              className="min-h-[44px] px-4 font-heading text-xs tracking-wide uppercase"
            >
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid de productos */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border bg-muted/40 p-4"
            />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          <ShoppingBag className="mb-2 size-8 opacity-40" />
          <p className="text-sm font-medium">No se encontraron productos</p>
          <p className="text-xs">Prueba con otra búsqueda o categoría</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((prod) => {
            const inCart = cartQuantities.get(prod.id) ?? 0;
            const promo = bestPromotion(prod.id, prod.priceCents, activePromos);
            const finalPrice = promo
              ? Math.max(0, prod.priceCents - promo.unitDiscountCents)
              : prod.priceCents;

            return (
              <button
                key={prod.id}
                type="button"
                onClick={() => onAddToCart(prod.id)}
                aria-label={`Agregar ${prod.name} al pedido. Precio ${formatMoney(finalPrice)}`}
                className={cn(
                  'group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/50 hover:shadow-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none min-h-[120px] select-none active:scale-[0.98]',
                  inCart > 0 && 'border-primary ring-1 ring-primary',
                )}
              >
                {/* Badge de cantidad en carrito */}
                {inCart > 0 && (
                  <span className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-primary font-heading text-xs font-bold text-primary-foreground shadow-xs">
                    {inCart}
                  </span>
                )}

                <div className="flex flex-col gap-1.5">
                  {/* Foto o icono provisional */}
                  {prod.imagePath ? (
                    <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted/30">
                      <img
                        src={imageStorage.publicUrl(prod.imagePath)}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted/20 text-muted-foreground/50">
                      <ShoppingBag className="size-8" />
                    </div>
                  )}

                  <h3 className="line-clamp-2 font-heading text-sm font-semibold leading-tight text-foreground group-hover:text-primary">
                    {prod.name}
                  </h3>
                </div>

                <div className="mt-2 flex flex-col gap-0.5 pt-1">
                  {promo ? (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground line-through">
                          {formatMoney(prod.priceCents)}
                        </span>
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[0.65rem] font-bold text-emerald-600 dark:text-emerald-400">
                          <Tag className="size-2.5" />
                          -{formatMoney(promo.unitDiscountCents)}
                        </span>
                      </div>
                      <span className="font-heading text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(finalPrice)}
                      </span>
                    </div>
                  ) : (
                    <span className="font-heading text-base font-bold text-foreground">
                      {formatMoney(prod.priceCents)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
