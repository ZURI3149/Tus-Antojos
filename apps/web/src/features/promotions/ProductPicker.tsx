import { formatMoney, type Category, type Product } from '@tus-antojos/shared';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';

export interface ProductPickerProps {
  categories: Category[];
  products: Product[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  disabled?: boolean;
}

export function ProductPicker({
  categories,
  products,
  selectedIds,
  onChange,
  error,
  disabled = false,
}: ProductPickerProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories],
  );

  const toggleProduct = (productId: string) => {
    if (disabled) return;
    if (selectedSet.has(productId)) {
      onChange(selectedIds.filter((id) => id !== productId));
    } else {
      onChange([...selectedIds, productId]);
    }
  };

  const addCategoryProducts = (categoryId: string) => {
    if (disabled) return;
    const catProductIds = activeProducts
      .filter((p) => p.categoryId === categoryId)
      .map((p) => p.id);
    const merged = Array.from(new Set([...selectedIds, ...catProductIds]));
    onChange(merged);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b pb-2">
        <span className="font-heading text-sm font-medium tracking-wide uppercase">
          Productos incluidos ({selectedIds.length})
        </span>
        {selectedIds.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange([])}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Quitar todos
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-col gap-5 max-h-80 overflow-y-auto pr-1">
        {sortedCategories.map((category) => {
          const catProducts = activeProducts.filter((p) => p.categoryId === category.id);
          if (catProducts.length === 0) return null;

          const allSelected = catProducts.every((p) => selectedSet.has(p.id));

          return (
            <div key={category.id} className="rounded-md border p-3 bg-card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-foreground">{category.name}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || allSelected}
                  onClick={() => addCategoryProducts(category.id)}
                  aria-label={`Agregar toda la categoría ${category.name}`}
                  className="text-xs"
                >
                  {allSelected ? 'Todos agregados' : 'Agregar toda la categoría'}
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {catProducts.map((prod) => {
                  const isChecked = selectedSet.has(prod.id);
                  return (
                    <label
                      key={prod.id}
                      className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border hover:bg-secondary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProduct(prod.id)}
                          disabled={disabled}
                          aria-label={prod.name}
                          className="size-4 rounded border-input text-primary focus:ring-ring"
                        />
                        <span className="text-sm font-medium truncate">{prod.name}</span>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground ml-2 whitespace-nowrap">
                        {formatMoney(prod.priceCents)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
