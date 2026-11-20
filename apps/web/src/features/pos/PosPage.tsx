import { ShoppingBasket } from 'lucide-react';
import { ComingSoon } from '@/components/coming-soon';
import { PageHeader } from '@/components/page-header';

// Pantalla provisional (módulo platform). Se construye en su propio módulo.
export function PosPage() {
  return (
    <section className="flex flex-col gap-8">
      <PageHeader eyebrow="Punto de venta" title="Caja" />
      <ComingSoon icon={ShoppingBasket} title="Pronto podrás cobrar desde aquí">
        En construcción. Aquí irá la caja (carrito, cobro y tickets).
      </ComingSoon>
    </section>
  );
}
