import { useState } from 'react';
import { CreditCard, MessageSquare, Minus, Plus, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import { formatMoney, type PricedCartLine } from '@tus-antojos/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CartState } from './use-cart';

export interface CartSidebarProps {
  cart: CartState;
  onCheckout: () => void;
}

export function CartSidebar({ cart, onCheckout }: CartSidebarProps) {
  const { pricedCart, totalItems, setQuantity, removeItem, clearCart, setNote } = cart;
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const hasItems = pricedCart.lines.length > 0;

  return (
    <aside
      aria-label="Carrito de pedido actual"
      className="flex flex-col rounded-xl border bg-card shadow-xs lg:sticky lg:top-4 lg:max-h-[calc(100vh-5rem)]"
    >
      {/* Cabecera del carrito */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="size-5 text-primary" />
          <h2 className="font-heading text-base font-bold tracking-wide">Pedido actual</h2>
        </div>
        {hasItems && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-heading text-xs font-semibold text-primary">
            {totalItems} {totalItems === 1 ? 'ítem' : 'ítems'}
          </span>
        )}
      </div>

      {/* Lista de líneas con scrollbar-gutter: stable para evitar saltos de layout */}
      <div className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-gutter:stable]">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <ShoppingBag className="mb-2 size-8 opacity-30" />
            <p className="text-sm font-medium">El carrito está vacío</p>
            <p className="text-xs">Selecciona productos del catálogo para comenzar</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pricedCart.lines.map((line: PricedCartLine) => {
              const hasDiscount = line.unitDiscountCents > 0;
              const isNoteOpen = editingNoteId === line.productId || Boolean(line.note);

              return (
                <li key={line.productId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-heading text-sm font-semibold text-foreground">
                        {line.productName}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{formatMoney(line.unitPriceCents)} c/u</span>
                        {hasDiscount && (
                          <span className="inline-flex items-center gap-0.5 rounded-sm bg-emerald-500/10 px-1 py-0.2 text-[0.65rem] font-bold text-emerald-600 dark:text-emerald-400">
                            <Tag className="size-2.5" />
                            {line.promotionName ?? 'Promo'} (-{formatMoney(line.unitDiscountCents)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="font-heading text-sm font-bold tabular-nums text-foreground">
                        {formatMoney(line.lineTotalCents)}
                      </span>
                      {hasDiscount && (
                        <span className="text-[0.65rem] text-muted-foreground line-through tabular-nums">
                          {formatMoney(line.unitPriceCents * line.quantity)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fila de controles y nota */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingNoteId(isNoteOpen && !line.note ? null : line.productId)
                      }
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <MessageSquare className="size-3" />
                      <span>{line.note ? 'Editar nota' : 'Nota'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(line.productId, line.quantity - 1)}
                        aria-label={`Restar una unidad de ${line.productName}`}
                        className="size-7 rounded-md"
                      >
                        <Minus className="size-3" />
                      </Button>

                      <span
                        aria-label={`Cantidad: ${line.quantity}`}
                        className="min-w-6 text-center font-heading text-sm font-bold tabular-nums"
                      >
                        {line.quantity}
                      </span>

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(line.productId, line.quantity + 1)}
                        aria-label={`Sumar una unidad de ${line.productName}`}
                        className="size-7 rounded-md"
                      >
                        <Plus className="size-3" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(line.productId)}
                        aria-label={`Quitar ${line.productName} del pedido`}
                        className="size-7 rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Campo de nota de cocina */}
                  {isNoteOpen && (
                    <div className="mt-1">
                      <Input
                        type="text"
                        maxLength={140}
                        placeholder="Nota de preparación (ej. sin azúcar, para llevar)"
                        value={line.note}
                        onChange={(e) => setNote(line.productId, e.target.value)}
                        className="h-8 text-xs"
                        aria-label={`Nota de cocina para ${line.productName}`}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Resumen y acciones */}
      <div className="flex flex-col gap-3 border-t bg-muted/20 p-4">
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatMoney(pricedCart.subtotalCents)}</span>
          </div>

          {pricedCart.discountCents > 0 && (
            <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1">
                <Tag className="size-3.5" />
                Descuentos aplicados
              </span>
              <span className="tabular-nums">-{formatMoney(pricedCart.discountCents)}</span>
            </div>
          )}

          <div className="mt-1 flex items-baseline justify-between border-t pt-2 font-heading text-lg font-bold">
            <span>Total a pagar</span>
            <span className="text-xl tabular-nums text-foreground">
              {formatMoney(pricedCart.totalCents)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={clearCart}
            disabled={!hasItems}
            aria-label="Vaciar carrito"
            className="min-h-[48px] px-3 font-heading text-xs"
          >
            <Trash2 className="size-4" />
            Vaciar
          </Button>

          <Button
            type="button"
            variant="default"
            onClick={onCheckout}
            disabled={!hasItems}
            className="flex-1 min-h-[48px] font-heading text-sm font-bold tracking-wide uppercase shadow-sm"
          >
            <CreditCard className="size-4 mr-1.5" />
            Cobrar {formatMoney(pricedCart.totalCents)}
          </Button>
        </div>
      </div>
    </aside>
  );
}
