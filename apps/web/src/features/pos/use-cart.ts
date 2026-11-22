import { useMemo, useState } from 'react';
import type { Product } from '@tus-antojos/shared';
import { priceCart, type CartLine, type PricedCart } from '@tus-antojos/shared';
import type { PromotionRowData } from '@/features/promotions/reader';

export interface CartItem {
  productId: string;
  quantity: number;
  note: string;
}

export function useCart(products: Product[] = [], promotions: PromotionRowData[] = []) {
  const [clientOrderId, setClientOrderId] = useState<string>(() => crypto.randomUUID());
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (productId: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === productId);
      if (idx >= 0) {
        const copy = [...prev];
        const existing = copy[idx]!;
        copy[idx] = { ...existing, quantity: Math.min(999, existing.quantity + 1) };
        return copy;
      }
      return [...prev, { productId, quantity: 1, note: '' }];
    });
  };

  const setQuantity = (productId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((i) => i.productId !== productId);
      }
      return prev.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.min(999, quantity) } : i,
      );
    });
  };

  const setNote = (productId: string, note: string) => {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, note: note.slice(0, 140) } : i)),
    );
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const clearCart = () => {
    setItems([]);
    setClientOrderId(crypto.randomUUID());
  };

  const activePromos = useMemo(
    () => promotions.filter((p) => p.isActive),
    [promotions],
  );

  const pricedCart: PricedCart = useMemo(() => {
    const lines: CartLine[] = items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      note: i.note,
    }));
    return priceCart(lines, products, activePromos);
  }, [items, products, activePromos]);

  const totalItems = useMemo(
    () => items.reduce((acc, item) => acc + item.quantity, 0),
    [items],
  );

  return {
    clientOrderId,
    items,
    pricedCart,
    totalItems,
    addItem,
    setQuantity,
    setNote,
    removeItem,
    clearCart,
  };
}

export type CartState = ReturnType<typeof useCart>;
