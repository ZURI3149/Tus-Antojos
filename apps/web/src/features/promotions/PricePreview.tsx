import {
  formatMoney,
  promotionStatus,
  unitDiscount,
  type Product,
  type PromotionKind,
} from '@tus-antojos/shared';
import { usePromotions } from './api';

export interface PricePreviewProps {
  selectedProducts: Product[];
  kind: PromotionKind;
  value: number;
  currentPromotionId?: string;
}

export function PricePreview({
  selectedProducts,
  kind,
  value,
  currentPromotionId,
}: PricePreviewProps) {
  const promotions = usePromotions();

  const isValueValid =
    Number.isInteger(value) && value > 0 && (kind !== 'porcentaje' || value <= 100);

  if (selectedProducts.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        Selecciona al menos un producto para ver la vista previa del descuento.
      </div>
    );
  }

  if (!isValueValid) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        Ingresa un valor de descuento válido para calcular la vista previa.
      </div>
    );
  }

  return (
    <section
      aria-label="Vista previa de precios"
      data-testid="price-preview"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between border-b pb-2">
        <span className="font-heading text-sm font-medium tracking-wide uppercase">
          Vista previa de precios ({selectedProducts.length})
        </span>
      </div>

      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
        {selectedProducts.map((prod) => {
          const discount = unitDiscount(prod.priceCents, { kind, value });
          const finalPrice = Math.max(0, prod.priceCents - discount);

          // Buscar si otra promoción vigente da más descuento a este producto (D4)
          const competing = (promotions.data ?? [])
            .filter(
              (p) => p.id !== currentPromotionId && p.isActive && promotionStatus(p) === 'vigente',
            )
            .filter((p) => p.productIds.includes(prod.id))
            .map((p) => ({
              name: p.name,
              discount: unitDiscount(prod.priceCents, { kind: p.kind, value: p.value }),
            }))
            .filter((c) => c.discount > discount);

          return (
            <div
              key={prod.id}
              className="rounded-md border p-3 bg-card flex flex-col gap-1.5 text-sm"
            >
              <div className="flex items-center justify-between font-medium">
                <span>{prod.name}</span>
                <span className="tabular-nums">
                  <span className="text-muted-foreground line-through mr-1.5">
                    {formatMoney(prod.priceCents)}
                  </span>
                  →
                  <span className="text-primary font-semibold ml-1.5">
                    {formatMoney(finalPrice)}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Descuento por unidad: {formatMoney(discount)}</span>
              </div>

              {competing.length > 0 && (
                <div className="mt-1 rounded bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ Aviso: La promoción vigente «{competing[0]!.name}» otorga un mayor descuento (
                  {formatMoney(competing[0]!.discount)} vs {formatMoney(discount)}) para este
                  producto. En pedidos se aplicará esa promoción.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
