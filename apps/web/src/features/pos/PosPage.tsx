import { useMemo, useState } from 'react';
import { CloudOff, History } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney } from '@tus-antojos/shared';
import { PageHeader } from '@/components/page-header';
import { CartSidebar } from './CartSidebar';
import { CheckoutDialog, type CheckoutResult } from './CheckoutDialog';
import { PosNav } from './PosNav';
import { ProductGrid } from './ProductGrid';
import { useCart } from './use-cart';
import { formatSnapshotDate, usePosCatalog } from './use-pos-catalog';

export function PosPage() {
  const catalog = usePosCatalog();
  const { categories, products, promotions } = catalog;

  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const cart = useCart(products, promotions);

  const cartQuantities = useMemo(() => {
    return new Map(cart.items.map((i) => [i.productId, i.quantity]));
  }, [cart.items]);

  const handleCheckoutSuccess = ({ label, changeCents, queued }: CheckoutResult) => {
    const changeMsg = changeCents > 0 ? ` · Cambio: ${formatMoney(changeCents)}` : '';
    if (queued) {
      toast.info(`Pedido ${label} guardado sin conexión${changeMsg}`, {
        description: 'Pendiente de sincronizar: se enviará solo al volver la conexión.',
        duration: 6000,
      });
    } else {
      toast.success(`Pedido ${label} registrado con éxito${changeMsg}`, { duration: 5000 });
    }
    cart.clearCart();
    setCheckoutOpen(false);
  };

  const isLoading = catalog.source === 'loading';

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

      {catalog.source === 'snapshot' && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
        >
          <History aria-hidden className="size-4 shrink-0" />
          Catálogo del {formatSnapshotDate(catalog.savedAt)}: sin conexión se usan los precios y
          promociones de la última lectura. Al sincronizar, el sistema confirma el total.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Catálogo y selector de productos (7 cols en desktop) */}
        <div className="lg:col-span-7 xl:col-span-8">
          {catalog.source === 'none' ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
              <CloudOff aria-hidden className="size-8 opacity-50" />
              <p className="text-sm font-medium">
                Conéctate a internet una vez para cargar el catálogo
              </p>
              <p className="text-xs">
                Después la caja podrá vender sin conexión con la última lectura guardada.
              </p>
            </div>
          ) : (
            <ProductGrid
              products={products}
              categories={categories}
              promotions={promotions}
              cartQuantities={cartQuantities}
              onAddToCart={cart.addItem}
              isLoading={isLoading}
            />
          )}
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
