import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { formatMoney } from '@tus-antojos/shared';
import { PageHeader } from '@/components/page-header';
import { useCategories, useProducts } from '@/features/catalog/api';
import { usePromotions } from '@/features/promotions/api';
import { CartSidebar } from './CartSidebar';
import { CheckoutDialog } from './CheckoutDialog';
import { PosNav } from './PosNav';
import { ProductGrid } from './ProductGrid';
import { useCart } from './use-cart';

export function PosPage() {
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories();
  const { data: products = [], isLoading: isLoadingProducts } = useProducts();
  const { data: promotions = [], isLoading: isLoadingPromotions } = usePromotions();

  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const cart = useCart(products, promotions);

  const cartQuantities = useMemo(() => {
    return new Map(cart.items.map((i) => [i.productId, i.quantity]));
  }, [cart.items]);

  const handleCheckoutSuccess = (orderNumber: number, changeCents: number) => {
    const changeMsg = changeCents > 0 ? ` · Cambio: ${formatMoney(changeCents)}` : '';
    toast.success(`Pedido #${orderNumber} registrado con éxito${changeMsg}`, {
      duration: 5000,
    });
    cart.clearCart();
    setCheckoutOpen(false);
  };

  const isLoading = isLoadingCategories || isLoadingProducts || isLoadingPromotions;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHeader
          eyebrow="Punto de venta"
          title="Caja"
          description="Selecciona los productos y procesa el cobro en efectivo o QR."
        />
        <PosNav />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Catálogo y selector de productos (7 cols en desktop) */}
        <div className="lg:col-span-7 xl:col-span-8">
          <ProductGrid
            products={products}
            categories={categories}
            promotions={promotions}
            cartQuantities={cartQuantities}
            onAddToCart={cart.addItem}
            isLoading={isLoading}
          />
        </div>

        {/* Panel lateral del carrito (5 cols en desktop) */}
        <div className="lg:col-span-5 xl:col-span-4">
          <CartSidebar cart={cart} onCheckout={() => setCheckoutOpen(true)} />
        </div>
      </div>

      {/* Diálogo nativo modal de cobro */}
      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={cart}
        onSuccess={handleCheckoutSuccess}
      />
    </section>
  );
}
